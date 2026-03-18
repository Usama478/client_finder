import { createBrowserRouter } from "react-router";
import PublicLayout from "./layouts/PublicLayout";
import AppLayout from "./layouts/AppLayout";
import HomePage from "./pages/public/HomePage";
import FeaturesPage from "./pages/public/FeaturesPage";
import PricingPage from "./pages/public/PricingPage";
import LoginPage from "./pages/auth/LoginPage";
import SignupPage from "./pages/auth/SignupPage";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
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
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import UserManagementPage from "./pages/admin/UserManagementPage";
import ApiKeyManagementPage from "./pages/admin/ApiKeyManagementPage";
import ThresholdConfigPage from "./pages/admin/ThresholdConfigPage";

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
    ],
  },
  {
    path: "/app",
    Component: AppLayout,
    children: [
      { index: true, Component: DashboardPage },
      { path: "search", Component: SearchBusinessesPage },
      { path: "clients", Component: ClientsPage },
      { path: "business/:id", Component: BusinessDetailsPage },
      { path: "contacts", Component: ContactsPage },
      { path: "email", Component: EmailWorkspacePage },
      { path: "activity", Component: ActivityPage },
      { path: "contexts", Component: ContextsPage },
      { path: "billing", Component: BillingPage },
      { path: "settings", Component: SettingsPage },
      { path: "admin", Component: AdminDashboardPage },
      { path: "admin/users", Component: UserManagementPage },
      { path: "admin/api-keys", Component: ApiKeyManagementPage },
      { path: "admin/thresholds", Component: ThresholdConfigPage },
    ],
  },
]);
