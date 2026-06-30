import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '../components/guards/ProtectedRoute.tsx';
import { RootRedirect } from '../components/guards/RootRedirect.tsx';
import { GuestRoute } from '../components/guards/GuestRoute.tsx';
import { GuestLayout } from '../components/layout/GuestLayout.tsx';
import { RouteFallback } from '../components/routes/RouteFallback.tsx';
import Login from '../pages/Login.tsx';
import Signup from '../pages/Signup.tsx';
import CreateOrg from '../pages/CreateOrg.tsx';

const AcceptInvite = lazy(() => import('../pages/AcceptInvite.tsx'));
const DashboardLayout = lazy(() => import('../pages/DashboardLayout.tsx'));
const Dashboard = lazy(() => import('../pages/Dashboard.tsx'));
const Members = lazy(() => import('../pages/Members.tsx'));
const OrgSettings = lazy(() => import('../pages/OrgSettings.tsx'));
const Profile = lazy(() => import('../pages/Profile.tsx'));
const Inventory = lazy(() => import('../pages/Inventory.tsx'));
const ReplacedExtinguishers = lazy(
  () => import('../pages/ReplacedExtinguishers.tsx'),
);
const CustomAssetInspections = lazy(
  () => import('../pages/CustomAssetInspections.tsx'),
);
const CustomAssetDetail = lazy(() => import('../pages/CustomAssetDetail.tsx'));
const TimeTracking = lazy(() => import('../pages/TimeTracking.tsx'));
const DataOrganizer = lazy(() => import('../pages/DataOrganizer.tsx'));
const ExtinguisherCreate = lazy(
  () => import('../pages/ExtinguisherCreate.tsx'),
);
const ExtinguisherEdit = lazy(() => import('../pages/ExtinguisherEdit.tsx'));
const Locations = lazy(() => import('../pages/Locations.tsx'));
const Workspaces = lazy(() => import('../pages/Workspaces.tsx'));
const WorkspaceDetail = lazy(() => import('../pages/WorkspaceDetail.tsx'));
const InspectionForm = lazy(() => import('../pages/InspectionForm.tsx'));
const ExtinguisherDetail = lazy(
  () => import('../pages/ExtinguisherDetail.tsx'),
);
const Notifications = lazy(() => import('../pages/Notifications.tsx'));
const Notes = lazy(() => import('../pages/Notes.tsx'));
const SyncQueue = lazy(() => import('../pages/SyncQueue.tsx'));
const Reports = lazy(() => import('../pages/Reports.tsx'));
const AuditLogs = lazy(() => import('../pages/AuditLogs.tsx'));
const NotFound = lazy(() => import('../pages/NotFound.tsx'));
const GuestCodeEntry = lazy(() => import('../pages/guest/GuestCodeEntry.tsx'));
const GuestDashboard = lazy(() => import('../pages/guest/GuestDashboard.tsx'));
const GuestInventory = lazy(() => import('../pages/guest/GuestInventory.tsx'));
const GuestLocations = lazy(() => import('../pages/guest/GuestLocations.tsx'));
const GuestWorkspaces = lazy(
  () => import('../pages/guest/GuestWorkspaces.tsx'),
);
const GuestWorkspaceDetail = lazy(
  () => import('../pages/guest/GuestWorkspaceDetail.tsx'),
);
const MarketingFeaturesPage = lazy(
  () => import('../pages/marketing/MarketingFeaturesPage.tsx'),
);
const MarketingPricingPage = lazy(
  () => import('../pages/marketing/MarketingPricingPage.tsx'),
);
const MarketingHowItWorksPage = lazy(
  () => import('../pages/marketing/MarketingHowItWorksPage.tsx'),
);
const Calculator = lazy(() => import('../pages/Calculator.tsx'));
const ImportGuide = lazy(() => import('../pages/ImportGuide.tsx'));
const DataOrganizerGuide = lazy(
  () => import('../pages/DataOrganizerGuide.tsx'),
);
const PrintableList = lazy(() => import('../pages/PrintableList.tsx'));
const PrintTags = lazy(() => import('../pages/PrintTags.tsx'));
const QRLanding = lazy(() => import('../pages/QRLanding.tsx'));
const AboutPage = lazy(() => import('../pages/marketing/AboutPage.tsx'));
const TermsPage = lazy(() => import('../pages/marketing/TermsPage.tsx'));
const PrivacyPage = lazy(() => import('../pages/marketing/PrivacyPage.tsx'));
const GettingStarted = lazy(() => import('../pages/GettingStarted.tsx'));
const FaqPage = lazy(() => import('../pages/FaqPage.tsx'));
const MarketingGettingStartedPage = lazy(
  () => import('../pages/marketing/MarketingGettingStartedPage.tsx'),
);
const MarketingFaqPage = lazy(
  () => import('../pages/marketing/MarketingFaqPage.tsx'),
);
const MarketingPlanDetailPage = lazy(
  () => import('../pages/marketing/MarketingPlanDetailPage.tsx'),
);
const CheckoutSuccess = lazy(() => import('../pages/CheckoutSuccess.tsx'));

export function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        {/* Root redirect based on auth/org state */}
        <Route path="/" element={<RootRedirect />} />

        {/* Public routes */}
        <Route path="/features" element={<MarketingFeaturesPage />} />
        <Route path="/pricing" element={<MarketingPricingPage />} />
        <Route path="/how-it-works" element={<MarketingHowItWorksPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy-policy" element={<PrivacyPage />} />
        <Route path="/privacy" element={<Navigate to="/privacy-policy" replace />} />
        <Route
          path="/getting-started"
          element={<MarketingGettingStartedPage />}
        />
        <Route path="/faq" element={<MarketingFaqPage />} />
        <Route path="/plans/:planId" element={<MarketingPlanDetailPage />} />
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
            <Route
              path="workspaces/:workspaceId"
              element={<GuestWorkspaceDetail />}
            />
          </Route>
        </Route>

        {/* Protected dashboard routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/checkout/success" element={<CheckoutSuccess />} />
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="profile" element={<Profile />} />
            <Route path="members" element={<Members />} />
            <Route path="settings" element={<OrgSettings />} />
            <Route path="inventory" element={<Inventory />} />
            <Route
              path="replaced-extinguishers"
              element={<ReplacedExtinguishers />}
            />
            <Route
              path="custom-asset-inspections"
              element={<CustomAssetInspections />}
            />
            <Route
              path="custom-asset-inspections/:assetId"
              element={<CustomAssetDetail />}
            />
            <Route path="data-organizer" element={<DataOrganizer />} />
            <Route path="inventory/new" element={<ExtinguisherCreate />} />
            <Route path="inventory/:extId" element={<ExtinguisherDetail />} />
            <Route
              path="inventory/:extId/edit"
              element={<ExtinguisherEdit />}
            />
            <Route path="locations" element={<Locations />} />
            <Route path="workspaces" element={<Workspaces />} />
            <Route
              path="workspaces/:workspaceId"
              element={<WorkspaceDetail />}
            />
            <Route
              path="workspaces/:workspaceId/inspect/:inspectionId"
              element={<InspectionForm />}
            />
            <Route
              path="workspaces/:workspaceId/inspect-ext/:extId"
              element={<ExtinguisherDetail />}
            />
            <Route path="notifications" element={<Notifications />} />
            <Route path="notes" element={<Notes />} />
            <Route path="sync-queue" element={<SyncQueue />} />
            <Route path="reports" element={<Reports />} />
            <Route path="time-tracking" element={<TimeTracking />} />
            <Route path="audit-logs" element={<AuditLogs />} />
            <Route path="calculator" element={<Calculator />} />
            <Route path="getting-started" element={<GettingStarted />} />
            <Route path="faq" element={<FaqPage />} />
            <Route path="import-guide" element={<ImportGuide />} />
            <Route
              path="data-organizer-guide"
              element={<DataOrganizerGuide />}
            />
            <Route path="inventory/print" element={<PrintableList />} />
            <Route path="inventory/print-tags" element={<PrintTags />} />
          </Route>
        </Route>

        {/* 404 catch-all */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
