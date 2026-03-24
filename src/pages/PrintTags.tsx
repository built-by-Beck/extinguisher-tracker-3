import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Printer, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.ts';
import { useOrg } from '../hooks/useOrg.ts';
import { hasFeature } from '../lib/planConfig.ts';
import { getExtinguisher, type Extinguisher } from '../services/extinguisherService.ts';
import { generateQRDataUrl, getExtinguisherQRUrl } from '../utils/qrCode.ts';
import { TagLabel } from '../components/extinguisher/TagLabel.tsx';

type LabelSize = 'small' | 'medium' | 'large';

const COLS: Record<LabelSize, number> = {
  small: 4,
  medium: 2,
  large: 1,
};

export default function PrintTags() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { userProfile } = useAuth();
  const { org } = useOrg();

  const orgId = userProfile?.activeOrgId ?? '';
  const flags = org?.featureFlags as Record<string, boolean> | null | undefined;

  const extIds = useMemo(() => {
    const stateIds = (location.state as { extIds?: string[] } | null)?.extIds;
    if (stateIds && stateIds.length > 0) return stateIds;
    const idsParam = searchParams.get('ids');
    if (idsParam) return idsParam.split(',').filter(Boolean);
    return [];
  }, [searchParams, location.state]);

  const isBulk = extIds.length > 1;
  const canPrint = isBulk
    ? hasFeature(flags, 'bulkTagPrinting', org?.plan)
    : hasFeature(flags, 'tagPrinting', org?.plan);

  const [labelSize, setLabelSize] = useState<LabelSize>('medium');
  const [extinguishers, setExtinguishers] = useState<Extinguisher[]>([]);
  const [qrDataUrls, setQrDataUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // Redirect if feature not available
  useEffect(() => {
    if (org && !canPrint) {
      navigate('/dashboard/inventory', { replace: true });
    }
  }, [org, canPrint, navigate]);

  // Load extinguishers
  useEffect(() => {
    if (!orgId || extIds.length === 0) {
      setLoading(false);
      return;
    }

    setLoading(true);
    Promise.all(extIds.map((id) => getExtinguisher(orgId, id)))
      .then((results) => {
        const valid = results.filter((e): e is Extinguisher => e !== null);
        setExtinguishers(valid);
      })
      .catch(() => setExtinguishers([]))
      .finally(() => setLoading(false));
  }, [orgId, extIds]);

  // Generate QR codes
  useEffect(() => {
    if (!orgId || extinguishers.length === 0) return;

    const entries = extinguishers
      .filter((e) => e.id)
      .map((e) => ({
        id: e.id!,
        url: getExtinguisherQRUrl(orgId, e.id!),
      }));

    Promise.all(
      entries.map(async ({ id, url }) => {
        const dataUrl = await generateQRDataUrl(url);
        return { id, dataUrl };
      }),
    ).then((pairs) => {
      const map: Record<string, string> = {};
      for (const { id, dataUrl } of pairs) {
        map[id] = dataUrl;
      }
      setQrDataUrls(map);
    });
  }, [orgId, extinguishers]);

  if (org && !canPrint) return null;

  return (
    <div className="min-h-screen bg-white text-black">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { size: auto; margin: 0.25in; }
        }
      `}</style>

      {/* Controls bar */}
      <div className="no-print sticky top-0 z-10 border-b border-gray-300 bg-white">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard/inventory')}
              className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-100"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <h1 className="text-lg font-semibold">Print Tags</h1>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={labelSize}
              onChange={(e) => setLabelSize(e.target.value as LabelSize)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            >
              <option value="small">Small (2" x 1")</option>
              <option value="medium">Medium (4" x 2")</option>
              <option value="large">Large (6" x 4")</option>
            </select>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              <Printer className="h-4 w-4" />
              Print
            </button>
          </div>
        </div>
      </div>

      {/* Tag grid */}
      <div className="mx-auto max-w-[1400px] p-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : extinguishers.length === 0 ? (
          <p className="py-10 text-center text-gray-500">No extinguishers found.</p>
        ) : (
          <>
            <div className="no-print mb-3 text-sm text-gray-700">
              {extinguishers.length} tag{extinguishers.length !== 1 ? 's' : ''} ready to print
            </div>
            <div
              className="grid gap-4"
              style={{ gridTemplateColumns: `repeat(${COLS[labelSize]}, max-content)` }}
            >
              {extinguishers.map((ext) => (
                <TagLabel
                  key={ext.id}
                  extinguisher={ext}
                  orgId={orgId}
                  orgName={org?.name}
                  qrDataUrl={ext.id ? qrDataUrls[ext.id] : undefined}
                  labelSize={labelSize}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
