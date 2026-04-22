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
import DataOrganizer from '../pages/DataOrganizer.tsx';
import ExtinguisherCreate from '../pages/ExtinguisherCreate.tsx';
import ExtinguisherEdit from '../pages/ExtinguisherEdit.tsx';
import Locations from '../pages/Locations.tsx';
import Workspaces from '../pages/Workspaces.tsx';
import WorkspaceDetail from '../pages/WorkspaceDetail.tsx';
import InspectionForm from '../pages/InspectionForm.tsx';
import ExtinguisherDetail from '../pages/ExtinguisherDetail.tsx';
import Notifications from '../pages/Notifications.tsx';
import SyncQueue from '../pages/SyncQueue.tsx';
import Reports from '../pages/Reports.tsx';
import AuditLogs from '../pages/AuditLogs.tsx';
import NotFound from '../pages/NotFound.tsx';
import { ProtectedRoute } from '../components/guards/ProtectedRoute.tsx';
import { RootRedirect } from '../components/guards/RootRedirect.tsx';
import { GuestRoute } from '../components/guards/GuestRoute.tsx';
import { GuestLayout } from '../components/layout/GuestLayout.tsx';
import GuestCodeEntry from '../pages/guest/GuestCodeEntry.tsx';
import GuestDashboard from '../pages/guest/GuestDashboard.tsx';
import GuestInventory from '../pages/guest/GuestInventory.tsx';
import GuestLocations from '../pages/guest/GuestLocations.tsx';
import GuestWorkspaces from '../pages/guest/GuestWorkspaces.tsx';
import GuestWorkspaceDetail from '../pages/guest/GuestWorkspaceDetail.tsx';
import MarketingFeaturesPage from '../pages/marketing/MarketingFeaturesPage.tsx';
import MarketingPricingPage from '../pages/marketing/MarketingPricingPage.tsx';
import MarketingHowItWorksPage from '../pages/marketing/MarketingHowItWorksPage.tsx';
import Calculator from '../pages/Calculator.tsx';
import ImportGuide from '../pages/ImportGuide.tsx';
import DataOrganizerGuide from '../pages/DataOrganizerGuide.tsx';
import PrintableList from '../pages/PrintableList.tsx';
import PrintTags from '../pages/PrintTags.tsx';
import QRLanding from '../pages/QRLanding.tsx';
import AboutPage from '../pages/marketing/AboutPage.tsx';
import TermsPage from '../pages/marketing/TermsPage.tsx';
import PrivacyPage from '../pages/marketing/PrivacyPage.tsx';
import GettingStarted from '../pages/GettingStarted.tsx';
import FaqPage from '../pages/FaqPage.tsx';
import MarketingGettingStartedPage from '../pages/marketing/MarketingGettingStartedPage.tsx';
import MarketingFaqPage from '../pages/marketing/MarketingFaqPage.tsx';

export function AppRoutes() {
  return (
    <Routes>
      {/* Root redirect based on auth/org state */}
      <Route path="/" element={<RootRedirect />} />

      {/* Public routes */}
      <Route path="/features" element={<MarketingFeaturesPage />} />
      <Route path="/pricing" element={<MarketingPricingPage />} />
      <Route path="/how-it-works" element={<MarketingHowItWorksPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/getting-started" element={<MarketingGettingStartedPage />} />
      <Route path="/faq" element={<MarketingFaqPage />} />
      <Route path="/calculator" element={<Calculator />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/invite/:token" element={<AcceptInvite />} />
      <Route path="/create-org" element={<CreateOrg />} />
      <Route path="/qr/:orgId/:extId" element={<QRLanding />} />

      {/* Guest routes — public share link entry */}
      <Route path="/guest/code" element={<GuestCodeEntry />} />

      {/* Guest routes — token-based share link
          GuestRoute wraps with GuestProvider and auto-activates from :orgId + :token */}
      <Route path="/guest/:orgId/:token" element={<GuestRoute />}>
        <Route element={<GuestLayout />}>
          <Route index element={<GuestDashboard />} />
          <Route path="inventory" element={<GuestInventory />} />
          <Route path="locations" element={<GuestLocations />} />
          <Route path="workspaces" element={<GuestWorkspaces />} />
          <Route path="workspaces/:workspaceId" element={<GuestWorkspaceDetail />} />
        </Route>
      </Route>

      {/* Protected dashboard routes */}
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="members" element={<Members />} />
          <Route path="settings" element={<OrgSettings />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="data-organizer" element={<DataOrganizer />} />
          <Route path="inventory/new" element={<ExtinguisherCreate />} />
          <Route path="inventory/:extId" element={<ExtinguisherDetail />} />
          <Route path="inventory/:extId/edit" element={<ExtinguisherEdit />} />
          <Route path="locations" element={<Locations />} />
          <Route path="workspaces" element={<Workspaces />} />
          <Route path="workspaces/:workspaceId" element={<WorkspaceDetail />} />
          <Route path="workspaces/:workspaceId/inspect/:inspectionId" element={<InspectionForm />} />
          <Route path="workspaces/:workspaceId/inspect-ext/:extId" element={<ExtinguisherDetail />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="sync-queue" element={<SyncQueue />} />
          <Route path="reports" element={<Reports />} />
          <Route path="audit-logs" element={<AuditLogs />} />
          <Route path="calculator" element={<Calculator />} />
          <Route path="getting-started" element={<GettingStarted />} />
          <Route path="faq" element={<FaqPage />} />
          <Route path="import-guide" element={<ImportGuide />} />
          <Route path="data-organizer-guide" element={<DataOrganizerGuide />} />
          <Route path="inventory/print" element={<PrintableList />} />
          <Route path="inventory/print-tags" element={<PrintTags />} />
        </Route>
      </Route>

      {/* 404 catch-all */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
