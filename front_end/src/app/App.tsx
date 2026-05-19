import { AuthProvider } from "../lib/auth-context";
import { AppStateProvider } from "../lib/app-state-context";
import { RouterProvider } from "react-router";
import { router } from "./routes";
import { Toaster } from "./components/ui/sonner";

export default function App() {
  return (
    <AuthProvider>
      <AppStateProvider>
        <RouterProvider router={router} />
        <Toaster />
      </AppStateProvider>
    </AuthProvider>
  );
}
