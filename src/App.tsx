import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext.tsx';
import { OrgProvider } from './contexts/OrgContext.tsx';
import { OfflineProvider } from './contexts/OfflineContext.tsx';
import { AppRoutes } from './routes/index.tsx';

function App() {
  return (
    <BrowserRouter>
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
