import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext.tsx';
import { OrgProvider } from './contexts/OrgContext.tsx';
import { OfflineProvider } from './contexts/OfflineContext.tsx';
import { AppRoutes } from './routes/index.tsx';
import { useAdSenseScript } from './components/ads/useAdSense.ts';

function AdSenseLoader() {
  useAdSenseScript();
  return null;
}

function App() {
  return (
    <BrowserRouter>
      <AdSenseLoader />
      <AuthProvider>
        <OrgProvider>
          <OfflineProvider>
            <AppRoutes />
          </OfflineProvider>
        </OrgProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
