import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import fft from 'firebase-functions-test';
import { adminDb } from '../utils/admin.js';
import { replaceExtinguisher } from '../lifecycle/replaceExtinguisher.js';

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

type BaseRequest = {
  auth: { uid: string; token: { email: string } };
  data: {
    orgId: string;
    oldExtinguisherId: string;
    newExtinguisherData: {
      assetId: string;
      serial: string;
      barcode?: string | null;
      manufacturer?: string | null;
      extinguisherType?: string | null;
      lastSixYearMaintenance?: boolean;
      lastHydroTest?: boolean;
    };
    reason: string;
  };
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

describe('replaceExtinguisher', () => {
  const wrapped = testEnv.wrap(replaceExtinguisher) as (request: typeof baseRequest) => Promise<unknown>;
  const baseRequest: BaseRequest = {
    auth: { uid: 'owner-1', token: { email: 'owner@test.com' } },
    data: {
      orgId: 'org-1',
      oldExtinguisherId: 'ext-1',
      newExtinguisherData: {
        assetId: 'FE-001',
        serial: 'NEW-SERIAL',
        barcode: 'NEW-BARCODE',
        manufacturer: 'Amerex',
        extinguisherType: 'ABC',
      },
      reason: 'Damaged',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

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

  function setup({
    oldData,
    activeConflicts = [],
  }: {
    oldData: Record<string, unknown>;
    activeConflicts?: TestDoc[];
  }) {
    const memberSnap: TestSnap = { exists: true, data: () => ({ role: 'owner', status: 'active' }) };
    const orgSnap: TestSnap = { exists: true, data: () => ({ subscriptionStatus: 'active' }) };
    const oldExtSnap: TestSnap = { exists: true, data: () => oldData };
    const extRef: TestDocRef = { path: 'org/org-1/extinguishers/ext-1' };
    const histRef: TestDocRef = { path: 'org/org-1/extinguishers/ext-1/replacementHistory/hist-1' };

    mockAdminDb.doc.mockImplementation((path: string) => {
      if (path === 'org/org-1/members/owner-1') {
        return { path, get: jest.fn<() => Promise<TestSnap>>(() => Promise.resolve(memberSnap)) };
      }
      if (path === 'org/org-1') return { path };
      if (path === 'org/org-1/extinguishers/ext-1') return extRef;
      return { path };
    });

    mockAdminDb.collection.mockImplementation((path: string) => {
      if (path === 'org/org-1/extinguishers/ext-1/replacementHistory') {
        return { ...makeQuery(path), doc: jest.fn(() => histRef) };
      }
      if (path === 'org/org-1/auditLogs') {
        return { ...makeQuery(path), doc: jest.fn(() => ({ path: 'org/org-1/auditLogs/audit-1' })) };
      }
      return makeQuery(path);
    });

    const tx: TestTx = {
      get: jest.fn((refOrQuery: TestDocRef | TestQuery) => {
        if (refOrQuery.path === 'org/org-1') return Promise.resolve(orgSnap);
        if (refOrQuery.path === 'org/org-1/extinguishers/ext-1') return Promise.resolve(oldExtSnap);

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

        const assetMatch = conditions.some((condition) => condition.field === 'assetId' && condition.value === oldData.assetId);
        if (assetMatch) {
          return Promise.resolve({
            docs: [{ id: 'ext-1', path: 'org/org-1/extinguishers/ext-1', data: () => oldData }],
          });
        }
        return Promise.resolve({ docs: [] });
      }),
      set: jest.fn(),
      update: jest.fn(),
    };
    mockAdminDb.runTransaction.mockImplementation(async (cb) => await cb(tx));
    return { tx, histRef };
  }

  it('replaces an active extinguisher in place and archives the prior snapshot', async () => {
    const oldData = {
      assetId: 'FE-001',
      serial: 'OLD-SERIAL',
      barcode: 'OLD-BARCODE',
      category: 'standard',
      lifecycleStatus: 'active',
      status: 'active',
      deletedAt: null,
    };
    const { tx, histRef } = setup({ oldData });

    const result = await wrapped(baseRequest);

    expect(result).toEqual({ extinguisherId: 'ext-1' });
    expect(tx.set).toHaveBeenCalledWith(
      histRef,
      expect.objectContaining({
        priorSnapshot: expect.objectContaining({ serial: 'OLD-SERIAL' }),
        previousSerial: 'OLD-SERIAL',
        previousBarcode: 'OLD-BARCODE',
        previousAssetId: 'FE-001',
        newSerial: 'NEW-SERIAL',
        newBarcode: 'NEW-BARCODE',
        newAssetId: 'FE-001',
        currentExtinguisherId: 'ext-1',
        waitingForService: false,
        sentForService: false,
        discarded: false,
        returned: false,
        reason: 'Damaged',
      }),
    );
    expect(tx.update).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'org/org-1/extinguishers/ext-1' }),
      expect.objectContaining({
        assetId: 'FE-001',
        serial: 'NEW-SERIAL',
        barcode: 'NEW-BARCODE',
        lastSixYearMaintenance: null,
        lastHydroTest: null,
        lifecycleStatus: 'active',
        status: 'active',
        isActive: true,
      }),
    );
    expect(tx.set).toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.stringContaining('/auditLogs/') }),
      expect.objectContaining({
        details: expect.objectContaining({
          oldAssetId: 'FE-001',
          newAssetId: 'FE-001',
          previousSerial: 'OLD-SERIAL',
          newSerial: 'NEW-SERIAL',
        }),
      }),
    );
  });

  it('allows an intentional asset number change when the new asset is unique', async () => {
    const oldData = {
      assetId: 'FE-001',
      serial: 'OLD-SERIAL',
      barcode: 'OLD-BARCODE',
      category: 'standard',
      lifecycleStatus: 'active',
      status: 'active',
      deletedAt: null,
    };
    const { tx } = setup({ oldData });

    await wrapped({
      ...baseRequest,
      data: {
        ...baseRequest.data,
        newExtinguisherData: {
          ...baseRequest.data.newExtinguisherData,
          assetId: 'FE-999',
        },
      },
    });

    expect(tx.update).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'org/org-1/extinguishers/ext-1' }),
      expect.objectContaining({
        assetId: 'FE-999',
      }),
    );
    expect(tx.set).toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.stringContaining('/auditLogs/') }),
      expect.objectContaining({
        details: expect.objectContaining({
          oldAssetId: 'FE-001',
          newAssetId: 'FE-999',
        }),
      }),
    );
  });

  it('rejects an asset number change when another active extinguisher already uses it', async () => {
    const oldData = {
      assetId: 'FE-001',
      serial: 'OLD-SERIAL',
      barcode: 'OLD-BARCODE',
      category: 'standard',
      lifecycleStatus: 'active',
      status: 'active',
      deletedAt: null,
    };
    const activeConflict: TestDoc = {
      id: 'ext-2',
      path: 'org/org-1/extinguishers/ext-2',
      data: () => ({
        assetId: 'FE-999',
        lifecycleStatus: 'active',
        status: 'active',
        deletedAt: null,
      }),
    };
    const { tx } = setup({ oldData, activeConflicts: [activeConflict] });

    await expect(
      wrapped({
        ...baseRequest,
        data: {
          ...baseRequest.data,
          newExtinguisherData: {
            ...baseRequest.data.newExtinguisherData,
            assetId: 'FE-999',
          },
        },
      }),
    ).rejects.toThrow(/already uses this asset number/i);
    expect(tx.update).not.toHaveBeenCalled();
  });

  it('does not rely on a limited duplicate query before active conflict filtering', async () => {
    const oldData = {
      assetId: 'FE-001',
      serial: 'OLD-SERIAL',
      barcode: 'OLD-BARCODE',
      category: 'standard',
      lifecycleStatus: 'active',
      status: 'active',
      deletedAt: null,
    };
    const activeConflict: TestDoc = {
      id: 'ext-99',
      path: 'org/org-1/extinguishers/ext-99',
      data: () => ({
        assetId: 'FE-999',
        lifecycleStatus: 'active',
        status: 'active',
        deletedAt: null,
      }),
    };
    const { tx } = setup({ oldData, activeConflicts: [activeConflict] });

    await expect(
      wrapped({
        ...baseRequest,
        data: {
          ...baseRequest.data,
          newExtinguisherData: {
            ...baseRequest.data.newExtinguisherData,
            assetId: 'FE-999',
          },
        },
      }),
    ).rejects.toThrow(/already uses this asset number/i);
    expect(tx.update).not.toHaveBeenCalled();
  });

  it('records selected service completion dates for a replacement unit', async () => {
    const oldData = {
      assetId: 'FE-001',
      serial: 'OLD-SERIAL',
      barcode: 'OLD-BARCODE',
      category: 'standard',
      lifecycleStatus: 'active',
      status: 'active',
      deletedAt: null,
    };
    const { tx } = setup({ oldData });

    const result = await wrapped({
      ...baseRequest,
      data: {
        ...baseRequest.data,
        newExtinguisherData: {
          ...baseRequest.data.newExtinguisherData,
          lastSixYearMaintenance: true,
          lastHydroTest: true,
        },
      },
    });

    expect(result).toEqual({ extinguisherId: 'ext-1' });
    expect(tx.update).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'org/org-1/extinguishers/ext-1' }),
      expect.objectContaining({
        lastSixYearMaintenance: expect.objectContaining({ seconds: expect.any(Number) }),
        nextSixYearMaintenance: expect.objectContaining({ seconds: expect.any(Number) }),
        lastHydroTest: expect.objectContaining({ seconds: expect.any(Number) }),
        nextHydroTest: expect.objectContaining({ seconds: expect.any(Number) }),
      }),
    );
  });

  it('rejects whitespace-only replacement serial numbers', async () => {
    setup({
      oldData: {
        assetId: 'FE-001',
        serial: 'OLD-SERIAL',
        category: 'standard',
        lifecycleStatus: 'active',
        status: 'active',
        deletedAt: null,
      },
    });

    await expect(
      wrapped({
        ...baseRequest,
        data: {
          ...baseRequest.data,
          newExtinguisherData: {
            ...baseRequest.data.newExtinguisherData,
            serial: '   ',
          },
        },
      }),
    ).rejects.toThrow(/serial is required/i);
  });

  it('rejects non-string replacement serial numbers with a validation error', async () => {
    setup({
      oldData: {
        assetId: 'FE-001',
        serial: 'OLD-SERIAL',
        category: 'standard',
        lifecycleStatus: 'active',
        status: 'active',
        deletedAt: null,
      },
    });

    await expect(
      wrapped({
        ...baseRequest,
        data: {
          ...baseRequest.data,
          newExtinguisherData: {
            ...baseRequest.data.newExtinguisherData,
            serial: 123 as unknown as string,
          },
        },
      }),
    ).rejects.toThrow(/serial is required/i);
  });

  it('returns a clear precondition error when the active extinguisher has no asset number', async () => {
    const { tx } = setup({
      oldData: {
        serial: 'OLD-SERIAL',
        category: 'standard',
        lifecycleStatus: 'active',
        status: 'active',
        deletedAt: null,
      },
    });

    await expect(wrapped(baseRequest)).rejects.toThrow(/asset number is missing/i);
    expect(tx.set).not.toHaveBeenCalled();
    expect(tx.update).not.toHaveBeenCalled();
  });
});
