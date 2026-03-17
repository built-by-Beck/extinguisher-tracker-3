import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.ts';
import { useOrg } from '../hooks/useOrg.ts';
import { ExtinguisherForm } from '../components/extinguisher/ExtinguisherForm.tsx';
import {
  getExtinguisher,
  updateExtinguisher,
  isAssetIdTaken,
  type Extinguisher,
} from '../services/extinguisherService.ts';

export default function ExtinguisherEdit() {
  const navigate = useNavigate();
  const { extId } = useParams<{ extId: string }>();
  const { userProfile } = useAuth();
  const { hasRole } = useOrg();

  const orgId = userProfile?.activeOrgId ?? '';
  const canEdit = hasRole(['owner', 'admin']);

  const [extinguisher, setExtinguisher] = useState<Extinguisher | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!orgId || !extId) return;
    getExtinguisher(orgId, extId).then((ext) => {
      setExtinguisher(ext);
      setPageLoading(false);
    });
  }, [orgId, extId]);

  async function handleSubmit(data: Partial<Extinguisher>) {
    if (!orgId || !extId) return;
    setSaving(true);

    // Check uniqueness if assetId changed
    if (data.assetId && data.assetId !== extinguisher?.assetId) {
      const taken = await isAssetIdTaken(orgId, data.assetId, extId);
      if (taken) {
        throw new Error(`Asset ID "${data.assetId}" is already in use.`);
      }
    }

    try {
      await updateExtinguisher(orgId, extId, data);
      navigate('/dashboard/inventory');
    } finally {
      setSaving(false);
    }
  }

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-red-600" />
      </div>
    );
  }

  if (!extinguisher) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-500">Extinguisher not found.</p>
      </div>
    );
  }

  if (!canEdit) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-500">You don't have permission to edit extinguishers.</p>
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
        <h1 className="text-2xl font-bold text-gray-900">Edit Extinguisher</h1>
        <p className="mt-1 text-sm text-gray-500">
          Editing {extinguisher.assetId}
        </p>
      </div>

      <ExtinguisherForm
        initialData={extinguisher}
        onSubmit={handleSubmit}
        submitLabel="Save Changes"
        loading={saving}
      />
    </div>
  );
}
