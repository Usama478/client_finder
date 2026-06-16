import { createBrowserRouter } from "react-router";
import PublicLayout from "./layouts/PublicLayout";
import AppLayout from "./layouts/AppLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import HomePage from "./pages/public/HomePage";
import FeaturesPage from "./pages/public/FeaturesPage";
import PricingPage from "./pages/public/PricingPage";
import LoginPage from "./pages/auth/LoginPage";
import SignupPage from "./pages/auth/SignupPage";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";
import VerifyEmailPage from "./pages/auth/VerifyEmailPage";
import DashboardPage from "./pages/app/DashboardPage";
import SearchBusinessesPage from "./pages/app/SearchBusinessesPage";
import ClientsPage from "./pages/app/ClientsPage";
import BusinessDetailsPage from "./pages/app/BusinessDetailsPage";
import ContactsPage from "./pages/app/ContactsPage";
import EmailWorkspacePage from "./pages/app/EmailWorkspacePage";
import ActivityPage from "./pages/app/ActivityPage";
import ContextsPage from "./pages/app/ContextsPage";
import BillingPage from "./pages/app/BillingPage";
import SettingsPage from "./pages/app/SettingsPage";
import ProfilePage from "./pages/app/ProfilePage";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import UserManagementPage from "./pages/admin/UserManagementPage";
import ApiKeyManagementPage from "./pages/admin/ApiKeyManagementPage";
import ThresholdConfigPage from "./pages/admin/ThresholdConfigPage";
import CampaignEnginePage from "./pages/app/CampaignEnginePage"
import LeadsPage from "./pages/app/LeadsPage"
import OnboardingPage from "./pages/app/OnboardingPage"
import SimpleSearchPage from "./pages/app/SimpleSearchPage"

export const router = createBrowserRouter([
  {
    path: "/",
    Component: PublicLayout,
    children: [
      { index: true, Component: HomePage },
      { path: "features", Component: FeaturesPage },
      { path: "pricing", Component: PricingPage },
    ],
  },
  {
    path: "/auth",
    children: [
      { path: "login", Component: LoginPage },
      { path: "signup", Component: SignupPage },
      { path: "forgot-password", Component: ForgotPasswordPage },
      { path: "reset-password", Component: ResetPasswordPage },
      { path: "verify-email", Component: VerifyEmailPage },
    ],
  },
  {
    path: "/onboarding",
    element: (
      <ProtectedRoute>
        <OnboardingPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/app",
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, Component: DashboardPage },
      { path: "simple-search", Component: SimpleSearchPage },
      { path: "search", Component: SearchBusinessesPage },
      { path: "leads", Component: LeadsPage },
      { path: "clients", Component: ClientsPage },
      { path: "business/:id", Component: BusinessDetailsPage },
      { path: "contacts", Component: ContactsPage },
      { path: "email", Component: EmailWorkspacePage },
      { path: "activity", Component: ActivityPage },
      { path: "contexts", Component: ContextsPage },
      { path: "campaigns", Component: CampaignEnginePage },
      { path: "billing", Component: BillingPage },
      { path: "settings", Component: SettingsPage },
      { path: "profile", Component: ProfilePage },
      { path: "admin", element: <ProtectedRoute requireAdmin={true}><AdminDashboardPage /></ProtectedRoute> },
      { path: "admin/users", element: <ProtectedRoute requireAdmin={true}><UserManagementPage /></ProtectedRoute> },
      { path: "admin/api-keys", element: <ProtectedRoute requireAdmin={true}><ApiKeyManagementPage /></ProtectedRoute> },
      { path: "admin/thresholds", element: <ProtectedRoute requireAdmin={true}><ThresholdConfigPage /></ProtectedRoute> },
    ],
  },
]);
