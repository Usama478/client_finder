import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from './AppShell';

import { DashboardPage } from '../pages/dashboard/DashboardPage';
import { SearchPage } from '../pages/search/SearchPage';
import { RelevancyPage } from '../pages/relevancy/RelevancyPage';
import { ValidationPage } from '../pages/validation/ValidationPage';
import { ClientsPage } from '../pages/clients/ClientsPage';
import { BusinessDetailsPage } from '../pages/business/BusinessDetailsPage';
import { SettingsPage } from '../pages/settings/SettingsPage';
import { ContextsPage } from '../pages/contexts/ContextsPage';
import { ActivityPage } from '../pages/activity/ActivityPage';
import { BillingPage } from '../pages/billing/BillingPage';
import { EmailPage } from '../pages/email/EmailPage';
import { AdminPage } from '../pages/admin/AdminPage';
import { LoginPage } from '../pages/auth/LoginPage';
import { SignupPage } from '../pages/auth/SignupPage';
import { ForgotPasswordPage } from '../pages/auth/ForgotPasswordPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { path: '/', element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'search', element: <SearchPage /> },
      { path: 'relevancy', element: <RelevancyPage /> },
      { path: 'validation', element: <ValidationPage /> },
      { path: 'clients', element: <ClientsPage /> },
      { path: 'business/:id', element: <BusinessDetailsPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'contexts', element: <ContextsPage /> },
      { path: 'activity', element: <ActivityPage /> },
      { path: 'billing', element: <BillingPage /> },
      { path: 'email', element: <EmailPage /> },
      { path: 'admin', element: <AdminPage /> },
    ],
  },
  { path: '/login', element: <LoginPage /> },
  { path: '/signup', element: <SignupPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
]);
