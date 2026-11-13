/**
 * Firestore security-rules checks for inspection integrity and the plan asset limit.
 * Run with the emulator:  pnpm test:rules
 *
 * Author: built_by_Beck
 */
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import {
  doc,
  setDoc,
  updateDoc,
  addDoc,
  collection,
  deleteDoc,
} from 'firebase/firestore';
const env = await initializeTestEnvironment({
  projectId: 'demo-ex3',
  firestore: {
    rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'),
    host: '127.0.0.1',
    port: 8080,
  },
});
let pass = 0,
  fail = 0;
async function t(name, p) {
  try {
    await p;
    pass++;
    console.log('ok  ', name);
  } catch (e) {
    fail++;
    console.log('FAIL', name, '-', e.message.slice(0, 120));
  }
}
async function seed(over = {}) {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'org/o1'), {
      plan: 'pro',
      subscriptionStatus: 'active',
      assetLimit: 2,
      name: 'x',
      ...over,
    });
    for (const [u, r] of [
      ['adm', 'admin'],
      ['insp', 'inspector'],
      ['view', 'viewer'],
    ])
      await setDoc(doc(db, `org/o1/members/${u}`), {
        uid: u,
        role: r,
        status: 'active',
      });
    await setDoc(doc(db, 'org/o1/assets/a1'), { name: 'AED' });
    await setDoc(doc(db, 'org/o1/workspaces/w1'), { status: 'active' });
    await setDoc(doc(db, 'org/o1/inspections/i1'), {
      workspaceId: 'w1',
      extinguisherId: 'e1',
      status: 'pass',
      inspectedBy: 'insp',
    });
    await setDoc(doc(db, 'org/o1/inspections/i2'), {
      workspaceId: 'w1',
      extinguisherId: 'e2',
      status: 'pending',
    });
    await setDoc(doc(db, 'org/o1/extinguishers/e1'), {
      assetId: '1',
      deletedAt: null,
      lifecycleStatus: 'active',
    });
    await setDoc(doc(db, 'org/o1/extinguishers/eDel'), {
      assetId: '9',
      deletedAt: new Date(),
      lifecycleStatus: 'deleted',
    });
    await setDoc(doc(db, 'org/o1/extinguishers/eLegacy'), {
      assetId: '8',
      deletedAt: null,
    });
  });
}
const db = (u) =>
  env.authenticatedContext(u, { email: u + '@t.com' }).firestore();
const pendingAsset = {
  orgId: 'o1',
  workspaceId: 'w1',
  targetType: 'asset',
  assetRefId: 'a1',
  status: 'pending',
  inspectedAt: null,
  inspectedBy: null,
  inspectedByEmail: null,
  attestation: null,
  notes: '',
};
const newExt = { assetId: '2', deletedAt: null, lifecycleStatus: 'active' };

await seed();
// inspections
await t(
  'inspector cannot forge a passed extinguisher inspection',
  assertFails(
    setDoc(doc(db('insp'), 'org/o1/inspections/forged'), {
      workspaceId: 'w1',
      extinguisherId: 'e1',
      status: 'pass',
      inspectedBy: 'adm',
    }),
  ),
);
await t(
  'inspector cannot edit a completed inspection',
  assertFails(
    updateDoc(doc(db('insp'), 'org/o1/inspections/i1'), { status: 'fail' }),
  ),
);
await t(
  'admin cannot edit a completed inspection',
  assertFails(
    updateDoc(doc(db('adm'), 'org/o1/inspections/i1'), {
      inspectedBy: 'someone',
    }),
  ),
);
await t(
  'admin cannot flip pending to pass directly',
  assertFails(
    updateDoc(doc(db('adm'), 'org/o1/inspections/i2'), { status: 'pass' }),
  ),
);
await t(
  'admin can seed blank pending asset inspection',
  assertSucceeds(
    setDoc(doc(db('adm'), 'org/o1/inspections/asset_a1_w1'), pendingAsset),
  ),
);
await t(
  'cannot overwrite seeded asset inspection',
  assertFails(
    setDoc(doc(db('adm'), 'org/o1/inspections/asset_a1_w1'), {
      ...pendingAsset,
      notes: 'x',
    }),
  ),
);
await env.withSecurityRulesDisabled((c) =>
  deleteDoc(doc(c.firestore(), 'org/o1/inspections/asset_a1_w1')),
);
await t(
  'asset inspection cannot be created already passed',
  assertFails(
    setDoc(doc(db('adm'), 'org/o1/inspections/asset_a1_w1'), {
      ...pendingAsset,
      status: 'pass',
      inspectedBy: 'adm',
    }),
  ),
);
await t(
  'asset inspection needs deterministic id',
  assertFails(
    setDoc(doc(db('adm'), 'org/o1/inspections/whatever'), pendingAsset),
  ),
);
await t(
  'asset inspection needs real asset',
  assertFails(
    setDoc(doc(db('adm'), 'org/o1/inspections/asset_nope_w1'), {
      ...pendingAsset,
      assetRefId: 'nope',
    }),
  ),
);
await t(
  'viewer cannot seed asset inspection',
  assertFails(
    setDoc(doc(db('view'), 'org/o1/inspections/asset_a1_w1'), pendingAsset),
  ),
);
await t(
  'admin can still delete a pending inspection',
  assertSucceeds(deleteDoc(doc(db('adm'), 'org/o1/inspections/i2'))),
);
await t(
  'admin cannot delete a completed inspection',
  assertFails(deleteDoc(doc(db('adm'), 'org/o1/inspections/i1'))),
);
await t(
  'client cannot write inspectionEvents',
  assertFails(
    addDoc(collection(db('insp'), 'org/o1/inspectionEvents'), {
      action: 'pass',
    }),
  ),
);
// asset limit
await t(
  'admin can create under limit (flag missing)',
  assertSucceeds(setDoc(doc(db('adm'), 'org/o1/extinguishers/e2'), newExt)),
);
await t(
  'admin can edit an active unit',
  assertSucceeds(
    updateDoc(doc(db('adm'), 'org/o1/extinguishers/e1'), { vicinity: 'hall' }),
  ),
);
await t(
  'admin can edit legacy unit without lifecycleStatus',
  assertSucceeds(
    updateDoc(doc(db('adm'), 'org/o1/extinguishers/eLegacy'), {
      vicinity: 'hall',
    }),
  ),
);
await t(
  'admin can restore when not at limit',
  assertSucceeds(
    updateDoc(doc(db('adm'), 'org/o1/extinguishers/eDel'), {
      deletedAt: null,
      lifecycleStatus: 'active',
    }),
  ),
);
await t(
  'admin cannot set assetLimitReached on org',
  assertFails(
    updateDoc(doc(db('adm'), 'org/o1'), { assetLimitReached: false }),
  ),
);
await seed({ assetLimitReached: true });
await t(
  'create blocked at limit',
  assertFails(setDoc(doc(db('adm'), 'org/o1/extinguishers/e3'), newExt)),
);
await t(
  'restore blocked at limit',
  assertFails(
    updateDoc(doc(db('adm'), 'org/o1/extinguishers/eDel'), {
      deletedAt: null,
      lifecycleStatus: 'active',
    }),
  ),
);
await t(
  'edit of active unit still allowed at limit',
  assertSucceeds(
    updateDoc(doc(db('adm'), 'org/o1/extinguishers/e1'), { vicinity: 'hall' }),
  ),
);
await t(
  'soft delete still allowed at limit',
  assertSucceeds(
    updateDoc(doc(db('adm'), 'org/o1/extinguishers/e1'), {
      deletedAt: new Date(),
      lifecycleStatus: 'deleted',
    }),
  ),
);
await t(
  'admin cannot clear the flag themselves',
  assertFails(
    updateDoc(doc(db('adm'), 'org/o1'), { assetLimitReached: false }),
  ),
);
await seed({ assetLimitReached: false });
await t(
  'create allowed when flag false',
  assertSucceeds(setDoc(doc(db('adm'), 'org/o1/extinguishers/e3'), newExt)),
);
await t(
  'inspector cannot create extinguisher',
  assertFails(setDoc(doc(db('insp'), 'org/o1/extinguishers/e4'), newExt)),
);
console.log(`\n${pass} passed, ${fail} failed`);
await env.cleanup();
process.exit(fail ? 1 : 0);
