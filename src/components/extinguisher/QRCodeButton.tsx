import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { QrCode, Loader2, Check } from 'lucide-react';
import { functions } from '../../lib/firebase.ts';
import { useAuth } from '../../hooks/useAuth.ts';

interface QRCodeButtonProps {
  extId: string;
  hasQR: boolean;
}

export function QRCodeButton({ extId, hasQR }: QRCodeButtonProps) {
  const { userProfile } = useAuth();
  const orgId = userProfile?.activeOrgId ?? '';

  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(hasQR);
  const [error, setError] = useState('');

  async function handleGenerate() {
    if (!orgId || !extId) return;
    setLoading(true);
    setError('');

    try {
      const generateQR = httpsCallable<
        { orgId: string; extId: string },
        { qrCodeValue: string; qrCodeUrl: string }
      >(functions, 'generateQRCode');

      await generateQR({ orgId, extId });
      setGenerated(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate QR code.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {error && (
        <p className="mb-2 text-xs text-red-600">{error}</p>
      )}
      <button
        onClick={handleGenerate}
        disabled={loading || generated}
        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
          generated
            ? 'border-green-300 bg-green-50 text-green-700'
            : 'border-gray-300 text-gray-700 hover:bg-gray-50'
        } disabled:opacity-50`}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : generated ? (
          <Check className="h-4 w-4" />
        ) : (
          <QrCode className="h-4 w-4" />
        )}
        {generated ? 'QR Generated' : 'Generate QR Code'}
      </button>
    </div>
  );
}
