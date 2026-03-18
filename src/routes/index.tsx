import { Routes, Route } from 'react-router-dom';
import Login from '../pages/Login.tsx';
import Signup from '../pages/Signup.tsx';
import AcceptInvite from '../pages/AcceptInvite.tsx';
import CreateOrg from '../pages/CreateOrg.tsx';
import DashboardLayout from '../pages/DashboardLayout.tsx';
import Dashboard from '../pages/Dashboard.tsx';
import Members from '../pages/Members.tsx';
import OrgSettings from '../pages/OrgSettings.tsx';
import Inventory from '../pages/Inventory.tsx';
import ExtinguisherCreate from '../pages/ExtinguisherCreate.tsx';
import ExtinguisherEdit from '../pages/ExtinguisherEdit.tsx';
import Locations from '../pages/Locations.tsx';
import Workspaces from '../pages/Workspaces.tsx';
import WorkspaceDetail from '../pages/WorkspaceDetail.tsx';
import InspectionForm from '../pages/InspectionForm.tsx';
import Notifications from '../pages/Notifications.tsx';
import NotFound from '../pages/NotFound.tsx';
import { ProtectedRoute } from '../components/guards/ProtectedRoute.tsx';
import { RootRedirect } from '../components/guards/RootRedirect.tsx';

export function AppRoutes() {
  return (
    <Routes>
      {/* Root redirect based on auth/org state */}
      <Route path="/" element={<RootRedirect />} />

      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/invite/:token" element={<AcceptInvite />} />
      <Route path="/create-org" element={<CreateOrg />} />

      {/* Protected dashboard routes */}
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="members" element={<Members />} />
          <Route path="settings" element={<OrgSettings />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="inventory/new" element={<ExtinguisherCreate />} />
          <Route path="inventory/:extId/edit" element={<ExtinguisherEdit />} />
          <Route path="locations" element={<Locations />} />
          <Route path="workspaces" element={<Workspaces />} />
          <Route path="workspaces/:workspaceId" element={<WorkspaceDetail />} />
          <Route path="workspaces/:workspaceId/inspect/:inspectionId" element={<InspectionForm />} />
          <Route path="notifications" element={<Notifications />} />
        </Route>
      </Route>

      {/* 404 catch-all */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
