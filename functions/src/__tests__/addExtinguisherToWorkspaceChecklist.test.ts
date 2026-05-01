import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import fft from 'firebase-functions-test';
import { adminDb } from '../utils/admin.js';
import { addExtinguisherToWorkspaceChecklist } from '../inspections/addExtinguisherToWorkspaceChecklist.js';

const testEnv = fft();

type TestSnap = {
  exists: boolean;
  data: () => Record<string, unknown>;
};

type TestDocRef = {
  path: string;
  get?: ReturnType<typeof jest.fn<() => Promise<TestSnap | undefined>>>;
};

type TestQuery = {
  where: ReturnType<typeof jest.fn<() => TestQuery>>;
  limit: ReturnType<typeof jest.fn<() => TestQuery>>;
  get: ReturnType<typeof jest.fn<() => Promise<{ empty: boolean; docs: Array<{ id: string }> }>>>;
};

type TestTx = {
  get: ReturnType<typeof jest.fn<(ref: TestDocRef) => Promise<TestSnap>>>;
  set: ReturnType<typeof jest.fn>;
  update: ReturnType<typeof jest.fn>;
};

const mockDoc = jest.fn<(path: string) => TestDocRef>();
const mockCollection = jest.fn<(path: string) => TestQuery>();
const mockRunTransaction = jest.fn<(cb: (tx: TestTx) => Promise<unknown>) => Promise<unknown>>();

const mockAdminDb = adminDb as unknown as {
  doc: typeof mockDoc;
  collection: typeof mockCollection;
  runTransaction: typeof mockRunTransaction;
};

mockAdminDb.doc = mockDoc;
mockAdminDb.collection = mockCollection;
mockAdminDb.runTransaction = mockRunTransaction;

describe('addExtinguisherToWorkspaceChecklist', () => {
  const baseRequest = {
    auth: { uid: 'owner-1', token: { email: 'owner@test.com' } },
    data: {
      orgId: 'org-1',
      workspaceId: '2026-04',
      extinguisherId: 'ext-1',
    },
  };
  const wrapped = testEnv.wrap(addExtinguisherToWorkspaceChecklist) as (
    request: typeof baseRequest,
  ) => Promise<unknown>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function setupDocs({
    memberRole = 'owner',
    workspaceStatus = 'active',
    deterministicExists = false,
    legacyExists = false,
  }: {
    memberRole?: string;
    workspaceStatus?: string;
    deterministicExists?: boolean;
    legacyExists?: boolean;
  } = {}) {
    const memberSnap: TestSnap = { exists: true, data: () => ({ role: memberRole, status: 'active' }) };
    const orgSnap: TestSnap = { exists: true, data: () => ({ subscriptionStatus: 'active' }) };
    const wsSnap: TestSnap = { exists: true, data: () => ({ status: workspaceStatus }) };
    const extSnap: TestSnap = {
      exists: true,
      data: () => ({
        assetId: 'FE-001',
        category: 'standard',
        lifecycleStatus: 'active',
        status: 'active',
        deletedAt: null,
      }),
    };
    const inspSnap: TestSnap = { exists: deterministicExists, data: () => ({}) };

    const directSnaps = new Map<string, TestSnap>([
      ['org/org-1/members/owner-1', memberSnap],
      ['org/org-1', orgSnap],
      ['org/org-1/workspaces/2026-04', wsSnap],
      ['org/org-1/extinguishers/ext-1', extSnap],
    ]);

    mockAdminDb.doc.mockImplementation((path) => ({
      path,
      get: jest.fn(() => Promise.resolve(directSnaps.get(path))),
    }));

    const legacyGet = jest.fn(() => Promise.resolve(
      legacyExists
        ? { empty: false, docs: [{ id: 'legacy-row' }] }
        : { empty: true, docs: [] },
    ));
    const legacyChain = {} as TestQuery;
    Object.assign(legacyChain, {
      where: jest.fn(() => legacyChain),
      limit: jest.fn(() => legacyChain),
      get: legacyGet,
    });
    mockAdminDb.collection.mockReturnValue(legacyChain);

    const tx: TestTx = {
      get: jest.fn((ref: { path: string }) => {
        if (ref.path === 'org/org-1') return Promise.resolve(orgSnap);
        if (ref.path === 'org/org-1/workspaces/2026-04') return Promise.resolve(wsSnap);
        if (ref.path === 'org/org-1/extinguishers/ext-1') return Promise.resolve(extSnap);
        if (ref.path === 'org/org-1/inspections/ext_ext-1_2026-04') return Promise.resolve(inspSnap);
        return Promise.resolve({ exists: false, data: () => ({}) });
      }),
      set: jest.fn(),
      update: jest.fn(),
    };
    mockAdminDb.runTransaction.mockImplementation(async (cb) => await cb(tx));
    return { tx, legacyGet };
  }

  it('creates one deterministic pending row and updates stats', async () => {
    const { tx } = setupDocs();

    const result = await wrapped(baseRequest);

    expect(result).toEqual({
      inspectionId: 'ext_ext-1_2026-04',
      created: true,
      alreadyExisted: false,
    });
    expect(tx.set).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'org/org-1/inspections/ext_ext-1_2026-04' }),
      expect.objectContaining({
        targetType: 'extinguisher',
        extinguisherId: 'ext-1',
        workspaceId: '2026-04',
        status: 'pending',
      }),
    );
    expect(tx.update).toHaveBeenCalled();
  });

  it('returns alreadyExisted for deterministic retry without incrementing stats', async () => {
    const { tx } = setupDocs({ deterministicExists: true });

    const result = await wrapped(baseRequest);

    expect(result).toEqual({
      inspectionId: 'ext_ext-1_2026-04',
      created: false,
      alreadyExisted: true,
    });
    expect(tx.set).not.toHaveBeenCalled();
    expect(tx.update).not.toHaveBeenCalled();
  });

  it('rejects archived workspaces before legacy already-exists acknowledgement', async () => {
    setupDocs({ workspaceStatus: 'archived', legacyExists: true });

    await expect(wrapped(baseRequest)).rejects.toThrow(/Only active workspaces/);
    expect(mockAdminDb.runTransaction).not.toHaveBeenCalled();
  });
});
