import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.ts';

export default function QRLanding() {
  const { orgId, extId } = useParams<{ orgId: string; extId: string }>();
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (!orgId || !extId) {
      navigate('/', { replace: true });
      return;
    }

    if (user) {
      navigate(`/dashboard/inventory/${extId}`, { replace: true });
    } else {
      navigate(`/login?redirect=/qr/${orgId}/${extId}`, { replace: true });
    }
  }, [user, loading, navigate, orgId, extId]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-red-600" />
    </div>
  );
}
