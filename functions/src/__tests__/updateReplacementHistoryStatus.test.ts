import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import fft from 'firebase-functions-test';
import { adminDb } from '../utils/admin.js';
import { updateReplacementHistoryStatus } from '../lifecycle/updateReplacementHistoryStatus.js';

const testEnv = fft();

type TestSnap = {
  exists: boolean;
  data: () => Record<string, unknown>;
};

type TestDoc = {
  id?: string;
  path: string;
  data: () => Record<string, unknown>;
};

type TestDocRef = {
  id?: string;
  path: string;
  get?: ReturnType<typeof jest.fn<() => Promise<TestSnap>>>;
};

type TestQuery = {
  path: string;
  _conditions: Array<{ field: string; value: unknown }>;
  _limit?: number;
  where: ReturnType<typeof jest.fn<(field: string, op: string, value: unknown) => TestQuery>>;
  limit: ReturnType<typeof jest.fn<(count: number) => TestQuery>>;
};

type TestCollection = TestQuery & {
  doc: ReturnType<typeof jest.fn<() => TestDocRef>>;
};

type TestTx = {
  get: ReturnType<typeof jest.fn<(refOrQuery: TestDocRef | TestQuery) => Promise<TestSnap | { docs: TestDoc[] }>>>;
  set: ReturnType<typeof jest.fn>;
  update: ReturnType<typeof jest.fn>;
};

const mockDoc = jest.fn<(path: string) => TestDocRef>();
const mockCollection = jest.fn<(path: string) => TestCollection | TestQuery>();
const mockRunTransaction = jest.fn<(cb: (tx: TestTx) => Promise<unknown>) => Promise<unknown>>();

const mockAdminDb = adminDb as unknown as {
  doc: typeof mockDoc;
  collection: typeof mockCollection;
  runTransaction: typeof mockRunTransaction;
};

mockAdminDb.doc = mockDoc;
mockAdminDb.collection = mockCollection;
mockAdminDb.runTransaction = mockRunTransaction;

function makeQuery(
  path: string,
  conditions: Array<{ field: string; value: unknown }> = [],
  limitedTo?: number,
): TestQuery {
  return {
    path,
    _conditions: conditions,
    _limit: limitedTo,
    where: jest.fn((field: string, _op: string, value: unknown) =>
      makeQuery(path, [...conditions, { field, value }], limitedTo),
    ),
    limit: jest.fn((count: number) => makeQuery(path, conditions, count)),
  };
}

describe('updateReplacementHistoryStatus', () => {
  const wrapped = testEnv.wrap(updateReplacementHistoryStatus) as (
    request: {
      auth: { uid: string; token: { email: string } };
      data: Record<string, unknown>;
    },
  ) => Promise<unknown>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function setup({
    historyData,
    activeConflicts = [],
  }: {
    historyData?: Record<string, unknown>;
    activeConflicts?: TestDoc[];
  } = {}) {
    const memberSnap: TestSnap = { exists: true, data: () => ({ role: 'owner', status: 'active' }) };
    const orgSnap: TestSnap = { exists: true, data: () => ({ subscriptionStatus: 'active' }) };
    const extSnap: TestSnap = { exists: true, data: () => ({ assetId: 'FE-001' }) };
    const histSnap: TestSnap = {
      exists: true,
      data: () => ({
        priorSnapshot: {
          assetId: 'FE-001',
          serial: 'OLD-SERIAL',
          barcode: 'OLD-BARCODE',
          category: 'standard',
          manufacturer: 'Amerex',
          extinguisherType: 'ABC',
          parentLocation: 'Building A',
          section: 'Hall',
          vicinity: 'Door',
          deletedAt: null,
        },
        returnedSpareExtinguisherId: null,
        ...historyData,
      }),
    };

    mockAdminDb.doc.mockImplementation((path) => {
      if (path === 'org/org-1/members/owner-1') {
        return { path, get: jest.fn(() => Promise.resolve(memberSnap)) };
      }
      return { path };
    });

    const spareRef: TestDocRef = { id: 'spare-1', path: 'org/org-1/extinguishers/spare-1' };
    mockAdminDb.collection.mockImplementation((path) => {
      if (path === 'org/org-1/auditLogs') {
        return { ...makeQuery(path), doc: jest.fn(() => ({ path: 'org/org-1/auditLogs/audit-1' })) };
      }
      if (path === 'org/org-1/extinguishers') {
        return { ...makeQuery(path), doc: jest.fn(() => spareRef) };
      }
      return makeQuery(path);
    });

    const tx: TestTx = {
      get: jest.fn((refOrQuery: TestDocRef | TestQuery) => {
        if (refOrQuery.path === 'org/org-1') return Promise.resolve(orgSnap);
        if (refOrQuery.path === 'org/org-1/extinguishers/ext-1') return Promise.resolve(extSnap);
        if (refOrQuery.path === 'org/org-1/extinguishers/ext-1/replacementHistory/hist-1') {
          return Promise.resolve(histSnap);
        }
        const conditions: Array<{ field: string; value: unknown }> =
          '_conditions' in refOrQuery ? refOrQuery._conditions : [];
        const conflictDocs = activeConflicts.filter((doc) =>
          conditions.every((condition) => doc.data()[condition.field] === condition.value),
        );
        if (conflictDocs.length > 0) {
          if ('_limit' in refOrQuery && refOrQuery._limit != null) {
            return Promise.resolve({ docs: [] });
          }
          return Promise.resolve({ docs: conflictDocs });
        }
        return Promise.resolve({ docs: [] });
      }),
      set: jest.fn(),
      update: jest.fn(),
    };
    mockAdminDb.runTransaction.mockImplementation(async (cb) => await cb(tx));
    return { tx, spareRef };
  }

  it('updates service status checkboxes on a replacement history row', async () => {
    const { tx } = setup();

    const result = await wrapped({
      auth: { uid: 'owner-1', token: { email: 'owner@test.com' } },
      data: {
        orgId: 'org-1',
        extinguisherId: 'ext-1',
        historyId: 'hist-1',
        waitingForService: true,
        sentForService: true,
        discarded: false,
        returned: false,
      },
    });

    expect(result).toEqual({ historyId: 'hist-1', returnedSpareExtinguisherId: null });
    expect(tx.update).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'org/org-1/extinguishers/ext-1/replacementHistory/hist-1' }),
      expect.objectContaining({
        waitingForService: true,
        sentForService: true,
        discarded: false,
        returned: false,
        returnedSpareExtinguisherId: null,
      }),
    );
  });

  it('creates one active spare record when a returned old unit is marked returned', async () => {
    const { tx, spareRef } = setup();

    const result = await wrapped({
      auth: { uid: 'owner-1', token: { email: 'owner@test.com' } },
      data: {
        orgId: 'org-1',
        extinguisherId: 'ext-1',
        historyId: 'hist-1',
        waitingForService: false,
        sentForService: false,
        discarded: false,
        returned: true,
        returnToSpare: {
          assetId: 'SPARE-001',
          serial: 'OLD-SERIAL',
          barcode: 'OLD-BARCODE',
        },
      },
    });

    expect(result).toEqual({ historyId: 'hist-1', returnedSpareExtinguisherId: 'spare-1' });
    expect(tx.set).toHaveBeenCalledWith(
      spareRef,
      expect.objectContaining({
        assetId: 'SPARE-001',
        serial: 'OLD-SERIAL',
        barcode: 'OLD-BARCODE',
        category: 'spare',
        lifecycleStatus: 'active',
        status: 'active',
        isActive: true,
      }),
    );
    expect(tx.update).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'org/org-1/extinguishers/ext-1/replacementHistory/hist-1' }),
      expect.objectContaining({
        returned: true,
        returnedSpareExtinguisherId: 'spare-1',
      }),
    );
  });

  it('blocks returned spare creation when any active matching asset exists beyond inactive duplicates', async () => {
    const activeConflict: TestDoc = {
      id: 'ext-99',
      path: 'org/org-1/extinguishers/ext-99',
      data: () => ({
        assetId: 'SPARE-001',
        lifecycleStatus: 'active',
        status: 'active',
        deletedAt: null,
      }),
    };
    const { tx } = setup({ activeConflicts: [activeConflict] });

    await expect(
      wrapped({
        auth: { uid: 'owner-1', token: { email: 'owner@test.com' } },
        data: {
          orgId: 'org-1',
          extinguisherId: 'ext-1',
          historyId: 'hist-1',
          waitingForService: false,
          sentForService: false,
          discarded: false,
          returned: true,
          returnToSpare: {
            assetId: 'SPARE-001',
            serial: 'OLD-SERIAL',
          },
        },
      }),
    ).rejects.toThrow(/already in use/i);
    expect(tx.update).not.toHaveBeenCalled();
  });
});
