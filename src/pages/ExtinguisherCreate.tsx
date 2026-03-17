import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.ts';
import { useOrg } from '../hooks/useOrg.ts';
import { ExtinguisherForm } from '../components/extinguisher/ExtinguisherForm.tsx';
import {
  createExtinguisher,
  isAssetIdTaken,
  getActiveExtinguisherCount,
  type Extinguisher,
} from '../services/extinguisherService.ts';

export default function ExtinguisherCreate() {
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const { org, hasRole } = useOrg();
  const [loading, setLoading] = useState(false);

  const orgId = userProfile?.activeOrgId ?? '';
  const canCreate = hasRole(['owner', 'admin']);

  async function handleSubmit(data: Partial<Extinguisher>) {
    if (!orgId || !user) return;
    setLoading(true);

    try {
      // Check asset limit
      if (org?.assetLimit) {
        const count = await getActiveExtinguisherCount(orgId);
        if (count >= org.assetLimit) {
          throw new Error(`Asset limit reached (${org.assetLimit}). Upgrade your plan to add more extinguishers.`);
        }
      }

      // Check uniqueness
      const taken = await isAssetIdTaken(orgId, data.assetId!);
      if (taken) {
        throw new Error(`Asset ID "${data.assetId}" is already in use.`);
      }

      await createExtinguisher(orgId, user.uid, data);
      navigate('/dashboard/inventory');
    } finally {
      setLoading(false);
    }
  }

  if (!canCreate) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-500">You don't have permission to add extinguishers.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate('/dashboard/inventory')}
          className="mb-3 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Inventory
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Add Extinguisher</h1>
        <p className="mt-1 text-sm text-gray-500">Fill in the details for the new extinguisher.</p>
      </div>

      <ExtinguisherForm
        onSubmit={handleSubmit}
        submitLabel="Add Extinguisher"
        loading={loading}
      />
    </div>
  );
}
