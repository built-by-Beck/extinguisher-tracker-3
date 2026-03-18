/**
 * ExtinguisherEdit page for EX3.
 * Edits extinguisher details, shows lifecycle/compliance section,
 * provides Replace and Retire actions for owner/admin.
 *
 * Author: built_by_Beck
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Loader2,
  ShieldCheck,
  Calendar,
  CalendarClock,
  Wrench,
  Droplets,
  RefreshCw,
  Archive,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth.ts';
import { useOrg } from '../hooks/useOrg.ts';
import { ExtinguisherForm } from '../components/extinguisher/ExtinguisherForm.tsx';
import { QRCodeButton } from '../components/extinguisher/QRCodeButton.tsx';
import { ComplianceStatusBadge } from '../components/compliance/ComplianceStatusBadge.tsx';
import { ReplaceExtinguisherModal } from '../components/extinguisher/ReplaceExtinguisherModal.tsx';
import {
  getExtinguisher,
  updateExtinguisher,
  isAssetIdTaken,
  type Extinguisher,
} from '../services/extinguisherService.ts';
import { retireExtinguisher } from '../services/lifecycleService.ts';
import { formatShortDate, formatDueDate, isOverdue } from '../utils/compliance.ts';

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
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [showRetireConfirm, setShowRetireConfirm] = useState(false);
  const [retireReason, setRetireReason] = useState('');
  const [retiring, setRetiring] = useState(false);
  const [retireError, setRetireError] = useState('');

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

  async function handleRetire() {
    if (!orgId || !extId || !retireReason.trim()) return;
    setRetiring(true);
    setRetireError('');
    try {
      await retireExtinguisher(orgId, extId, retireReason.trim());
      navigate('/dashboard/inventory');
    } catch (err) {
      setRetireError(err instanceof Error ? err.message : 'Failed to retire extinguisher.');
      setRetiring(false);
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

  const isActive = extinguisher.lifecycleStatus === 'active';
  const isRetired = extinguisher.lifecycleStatus === 'retired';
  const isReplaced = extinguisher.lifecycleStatus === 'replaced';

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Edit Extinguisher</h1>
            <p className="mt-1 text-sm text-gray-500">
              Editing {extinguisher.assetId}
            </p>
          </div>
          {extId && (
            <QRCodeButton extId={extId} hasQR={!!extinguisher.qrCodeValue} />
          )}
        </div>
      </div>

      {/* Lifecycle & Compliance Section */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Lifecycle & Compliance</h2>

        {/* Lifecycle status */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Compliance Status</span>
            <div className="mt-1">
              <ComplianceStatusBadge status={extinguisher.complianceStatus} size="md" />
            </div>
          </div>
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Lifecycle</span>
            <div className="mt-1">
              <span
                className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                  isActive
                    ? 'bg-green-100 text-green-700 border-green-200'
                    : isRetired
                    ? 'bg-gray-100 text-gray-600 border-gray-200'
                    : isReplaced
                    ? 'bg-blue-100 text-blue-700 border-blue-200'
                    : 'bg-gray-100 text-gray-600 border-gray-200'
                }`}
              >
                {(extinguisher.lifecycleStatus ?? 'unknown').replace(/\b\w/g, (l) => l.toUpperCase())}
              </span>
            </div>
          </div>
        </div>

        {/* Overdue flags */}
        {extinguisher.overdueFlags && extinguisher.overdueFlags.length > 0 && (
          <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            <div>
              <p className="text-sm font-medium text-red-700">Overdue flags:</p>
              <ul className="mt-1 list-disc list-inside text-sm text-red-600">
                {extinguisher.overdueFlags.map((flag) => (
                  <li key={flag}>{flag.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Due dates */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {/* Monthly */}
          <div className={`rounded-lg border p-3 ${
            isOverdue(extinguisher.nextMonthlyInspection)
              ? 'border-red-200 bg-red-50'
              : 'border-gray-200 bg-gray-50'
          }`}>
            <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
              <Calendar className="h-3.5 w-3.5" />
              Monthly Inspection
            </div>
            <p className="mt-1 text-sm font-semibold text-gray-900">
              {formatShortDate(extinguisher.nextMonthlyInspection)}
            </p>
            <p className={`text-xs ${
              isOverdue(extinguisher.nextMonthlyInspection) ? 'text-red-600' : 'text-gray-400'
            }`}>
              {formatDueDate(extinguisher.nextMonthlyInspection)}
            </p>
          </div>

          {/* Annual */}
          <div className={`rounded-lg border p-3 ${
            isOverdue(extinguisher.nextAnnualInspection)
              ? 'border-red-200 bg-red-50'
              : 'border-gray-200 bg-gray-50'
          }`}>
            <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
              <CalendarClock className="h-3.5 w-3.5" />
              Annual Inspection
            </div>
            <p className="mt-1 text-sm font-semibold text-gray-900">
              {formatShortDate(extinguisher.nextAnnualInspection)}
            </p>
            <p className={`text-xs ${
              isOverdue(extinguisher.nextAnnualInspection) ? 'text-red-600' : 'text-gray-400'
            }`}>
              {formatDueDate(extinguisher.nextAnnualInspection)}
            </p>
          </div>

          {/* Six-Year */}
          {extinguisher.requiresSixYearMaintenance && (
            <div className={`rounded-lg border p-3 ${
              isOverdue(extinguisher.nextSixYearMaintenance)
                ? 'border-red-200 bg-red-50'
                : 'border-gray-200 bg-gray-50'
            }`}>
              <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                <Wrench className="h-3.5 w-3.5" />
                Six-Year Maintenance
              </div>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {formatShortDate(extinguisher.nextSixYearMaintenance)}
              </p>
              <p className={`text-xs ${
                isOverdue(extinguisher.nextSixYearMaintenance) ? 'text-red-600' : 'text-gray-400'
              }`}>
                {formatDueDate(extinguisher.nextSixYearMaintenance)}
              </p>
            </div>
          )}

          {/* Hydro Test */}
          <div className={`rounded-lg border p-3 ${
            isOverdue(extinguisher.nextHydroTest)
              ? 'border-red-200 bg-red-50'
              : 'border-gray-200 bg-gray-50'
          }`}>
            <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
              <Droplets className="h-3.5 w-3.5" />
              Hydro Test
            </div>
            <p className="mt-1 text-sm font-semibold text-gray-900">
              {formatShortDate(extinguisher.nextHydroTest)}
            </p>
            <p className={`text-xs ${
              isOverdue(extinguisher.nextHydroTest) ? 'text-red-600' : 'text-gray-400'
            }`}>
              {formatDueDate(extinguisher.nextHydroTest)}
            </p>
          </div>
        </div>

        {/* Compliance icons legend */}
        <div className="mt-4 flex items-center gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-green-500" /> Compliant</span>
          <span className="flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5 text-red-500" /> Overdue</span>
        </div>

        {/* Replace / Retire actions (owner/admin + active only) */}
        {isActive && canEdit && (
          <div className="mt-5 flex flex-wrap gap-3 border-t border-gray-100 pt-4">
            <button
              onClick={() => setShowReplaceModal(true)}
              className="flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
            >
              <RefreshCw className="h-4 w-4" />
              Replace Extinguisher
            </button>
            <button
              onClick={() => setShowRetireConfirm(true)}
              className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              <Archive className="h-4 w-4" />
              Retire Extinguisher
            </button>
          </div>
        )}

        {(isRetired || isReplaced) && (
          <p className="mt-4 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-500">
            This extinguisher is {isRetired ? 'retired' : 'replaced'} and no longer in active service.
            {isReplaced && extinguisher.replacedByExtId && (
              <> Replaced by: <strong>{extinguisher.replacedByExtId}</strong></>
            )}
          </p>
        )}
      </div>

      {/* Edit form */}
      <ExtinguisherForm
        initialData={extinguisher}
        onSubmit={handleSubmit}
        submitLabel="Save Changes"
        loading={saving}
      />

      {/* Replace modal */}
      {showReplaceModal && extId && (
        <ReplaceExtinguisherModal
          orgId={orgId}
          oldExtinguisherId={extId}
          oldAssetId={extinguisher.assetId}
          onClose={() => setShowReplaceModal(false)}
        />
      )}

      {/* Retire confirmation */}
      {showRetireConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Retire Extinguisher?</h3>
            <p className="mt-1 text-sm text-gray-500">
              This will permanently remove <strong>{extinguisher.assetId}</strong> from active service.
              Historical records will be preserved.
            </p>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={retireReason}
                onChange={(e) => setRetireReason(e.target.value)}
                placeholder="e.g., End of service life, Damaged beyond repair"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>
            {retireError && (
              <p className="mt-2 text-sm text-red-600">{retireError}</p>
            )}
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => {
                  setShowRetireConfirm(false);
                  setRetireReason('');
                  setRetireError('');
                }}
                disabled={retiring}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRetire}
                disabled={retiring || !retireReason.trim()}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {retiring && <Loader2 className="h-4 w-4 animate-spin" />}
                Retire
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
