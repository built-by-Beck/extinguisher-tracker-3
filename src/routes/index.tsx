import { lazy, Suspense, type ComponentType } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '../components/guards/ProtectedRoute.tsx';
import { RootRedirect } from '../components/guards/RootRedirect.tsx';
import { GuestRoute } from '../components/guards/GuestRoute.tsx';
import { GuestLayout } from '../components/layout/GuestLayout.tsx';

const Login = lazy(() => import('../pages/Login.tsx'));
const Signup = lazy(() => import('../pages/Signup.tsx'));
const AcceptInvite = lazy(() => import('../pages/AcceptInvite.tsx'));
const CreateOrg = lazy(() => import('../pages/CreateOrg.tsx'));
const DashboardLayout = lazy(() => import('../pages/DashboardLayout.tsx'));
const Dashboard = lazy(() => import('../pages/Dashboard.tsx'));
const Members = lazy(() => import('../pages/Members.tsx'));
const OrgSettings = lazy(() => import('../pages/OrgSettings.tsx'));
const Inventory = lazy(() => import('../pages/Inventory.tsx'));
const DataOrganizer = lazy(() => import('../pages/DataOrganizer.tsx'));
const ExtinguisherCreate = lazy(() => import('../pages/ExtinguisherCreate.tsx'));
const ExtinguisherEdit = lazy(() => import('../pages/ExtinguisherEdit.tsx'));
const Locations = lazy(() => import('../pages/Locations.tsx'));
const Workspaces = lazy(() => import('../pages/Workspaces.tsx'));
const WorkspaceDetail = lazy(() => import('../pages/WorkspaceDetail.tsx'));
const InspectionForm = lazy(() => import('../pages/InspectionForm.tsx'));
const ExtinguisherDetail = lazy(() => import('../pages/ExtinguisherDetail.tsx'));
const Notifications = lazy(() => import('../pages/Notifications.tsx'));
const SyncQueue = lazy(() => import('../pages/SyncQueue.tsx'));
const Reports = lazy(() => import('../pages/Reports.tsx'));
const AuditLogs = lazy(() => import('../pages/AuditLogs.tsx'));
const NotFound = lazy(() => import('../pages/NotFound.tsx'));
const GuestCodeEntry = lazy(() => import('../pages/guest/GuestCodeEntry.tsx'));
const GuestDashboard = lazy(() => import('../pages/guest/GuestDashboard.tsx'));
const GuestInventory = lazy(() => import('../pages/guest/GuestInventory.tsx'));
const GuestLocations = lazy(() => import('../pages/guest/GuestLocations.tsx'));
const GuestWorkspaces = lazy(() => import('../pages/guest/GuestWorkspaces.tsx'));
const GuestWorkspaceDetail = lazy(() => import('../pages/guest/GuestWorkspaceDetail.tsx'));
const MarketingFeaturesPage = lazy(() => import('../pages/marketing/MarketingFeaturesPage.tsx'));
const MarketingPricingPage = lazy(() => import('../pages/marketing/MarketingPricingPage.tsx'));
const MarketingHowItWorksPage = lazy(() => import('../pages/marketing/MarketingHowItWorksPage.tsx'));
const Calculator = lazy(() => import('../pages/Calculator.tsx'));
const ImportGuide = lazy(() => import('../pages/ImportGuide.tsx'));
const DataOrganizerGuide = lazy(() => import('../pages/DataOrganizerGuide.tsx'));
const PrintableList = lazy(() => import('../pages/PrintableList.tsx'));
const PrintTags = lazy(() => import('../pages/PrintTags.tsx'));
const QRLanding = lazy(() => import('../pages/QRLanding.tsx'));
const AboutPage = lazy(() => import('../pages/marketing/AboutPage.tsx'));
const TermsPage = lazy(() => import('../pages/marketing/TermsPage.tsx'));
const PrivacyPage = lazy(() => import('../pages/marketing/PrivacyPage.tsx'));
const GettingStarted = lazy(() => import('../pages/GettingStarted.tsx'));
const FaqPage = lazy(() => import('../pages/FaqPage.tsx'));
const MarketingGettingStartedPage = lazy(() => import('../pages/marketing/MarketingGettingStartedPage.tsx'));
const MarketingFaqPage = lazy(() => import('../pages/marketing/MarketingFaqPage.tsx'));
const CheckoutSuccess = lazy(() => import('../pages/CheckoutSuccess.tsx'));

function RouteFallback() {
  return <div className="min-h-[40vh]" aria-busy="true" />;
}

function renderLazy(Component: ComponentType) {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Component />
    </Suspense>
  );
}

export function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        {/* Root redirect based on auth/org state */}
        <Route path="/" element={<RootRedirect />} />

      {/* Public routes */}
      <Route path="/features" element={renderLazy(MarketingFeaturesPage)} />
      <Route path="/pricing" element={renderLazy(MarketingPricingPage)} />
      <Route path="/how-it-works" element={renderLazy(MarketingHowItWorksPage)} />
      <Route path="/about" element={renderLazy(AboutPage)} />
      <Route path="/terms" element={renderLazy(TermsPage)} />
      <Route path="/privacy" element={renderLazy(PrivacyPage)} />
      <Route path="/getting-started" element={renderLazy(MarketingGettingStartedPage)} />
      <Route path="/faq" element={renderLazy(MarketingFaqPage)} />
      <Route path="/calculator" element={renderLazy(Calculator)} />
      <Route path="/login" element={renderLazy(Login)} />
      <Route path="/signup" element={renderLazy(Signup)} />
      <Route path="/invite/:token" element={renderLazy(AcceptInvite)} />
      <Route path="/create-org" element={renderLazy(CreateOrg)} />
      <Route path="/qr/:orgId/:extId" element={renderLazy(QRLanding)} />

      {/* Guest routes — public share link entry */}
      <Route path="/guest/code" element={renderLazy(GuestCodeEntry)} />

      {/* Guest routes — token-based share link
          GuestRoute wraps with GuestProvider and auto-activates from :orgId + :token */}
      <Route path="/guest/:orgId/:token" element={<GuestRoute />}>
        <Route element={<GuestLayout />}>
          <Route index element={renderLazy(GuestDashboard)} />
          <Route path="inventory" element={renderLazy(GuestInventory)} />
          <Route path="locations" element={renderLazy(GuestLocations)} />
          <Route path="workspaces" element={renderLazy(GuestWorkspaces)} />
          <Route path="workspaces/:workspaceId" element={renderLazy(GuestWorkspaceDetail)} />
        </Route>

      {/* Protected dashboard routes */}
      <Route element={<ProtectedRoute />}>
        <Route path="/checkout/success" element={renderLazy(CheckoutSuccess)} />
        <Route path="/dashboard" element={renderLazy(DashboardLayout)}>
          <Route index element={renderLazy(Dashboard)} />
          <Route path="members" element={renderLazy(Members)} />
          <Route path="settings" element={renderLazy(OrgSettings)} />
          <Route path="inventory" element={renderLazy(Inventory)} />
          <Route path="data-organizer" element={renderLazy(DataOrganizer)} />
          <Route path="inventory/new" element={renderLazy(ExtinguisherCreate)} />
          <Route path="inventory/:extId" element={renderLazy(ExtinguisherDetail)} />
          <Route path="inventory/:extId/edit" element={renderLazy(ExtinguisherEdit)} />
          <Route path="locations" element={renderLazy(Locations)} />
          <Route path="workspaces" element={renderLazy(Workspaces)} />
          <Route path="workspaces/:workspaceId" element={renderLazy(WorkspaceDetail)} />
          <Route path="workspaces/:workspaceId/inspect/:inspectionId" element={renderLazy(InspectionForm)} />
          <Route path="workspaces/:workspaceId/inspect-ext/:extId" element={renderLazy(ExtinguisherDetail)} />
          <Route path="notifications" element={renderLazy(Notifications)} />
          <Route path="sync-queue" element={renderLazy(SyncQueue)} />
          <Route path="reports" element={renderLazy(Reports)} />
          <Route path="audit-logs" element={renderLazy(AuditLogs)} />
          <Route path="calculator" element={renderLazy(Calculator)} />
          <Route path="getting-started" element={renderLazy(GettingStarted)} />
          <Route path="faq" element={renderLazy(FaqPage)} />
          <Route path="import-guide" element={renderLazy(ImportGuide)} />
          <Route path="data-organizer-guide" element={renderLazy(DataOrganizerGuide)} />
          <Route path="inventory/print" element={renderLazy(PrintableList)} />
          <Route path="inventory/print-tags" element={renderLazy(PrintTags)} />
        </Route>

      {/* 404 catch-all */}
      <Route path="*" element={renderLazy(NotFound)} />
    </Routes>
  );
}
