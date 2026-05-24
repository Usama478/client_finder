import { AuthProvider } from "../lib/auth-context";
import { AppStateProvider } from "../lib/app-state-context";
import { BackgroundJobsProvider } from "../lib/background-jobs-context";
import { RouterProvider } from "react-router";
import { router } from "./routes";
import { Toaster } from "./components/ui/sonner";

export default function App() {
  return (
    <AuthProvider>
      <AppStateProvider>
        <BackgroundJobsProvider>
          <RouterProvider router={router} />
          <Toaster />
        </BackgroundJobsProvider>
      </AppStateProvider>
    </AuthProvider>
  );
}
