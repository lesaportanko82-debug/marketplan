import { RouterProvider } from "react-router";
import { router } from "./routes";
import { Toaster } from "sonner";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "./lib/useAuth";
import { UsageProvider } from "./lib/useUsage";
import { AccessProvider } from "./lib/useAccess";
import { AuthPages } from "./components/AuthPages";
import { Loader2, Zap } from "lucide-react";

function LoadingFallback() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background gap-4">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center"
        style={{
          background: "linear-gradient(135deg, #d4a373 0%, #c0854a 50%, #a87040 100%)",
          boxShadow: "0 4px 20px rgba(212,163,115,0.3)",
        }}
      >
        <Zap className="w-6 h-6 text-white" />
      </div>
      <Loader2 className="w-5 h-5 text-[#d4a373] animate-spin" />
      <p className="text-[13px] text-muted-foreground">Загрузка...</p>
    </div>
  );
}

function AuthGate() {
  const { user, loading } = useAuth();

  // Show router immediately - Layout will handle auth checks for protected routes
  if (loading) {
    return <LoadingFallback />;
  }

  // Public routes like /onboarding are accessible without auth
  // Layout component handles auth requirement for protected routes
  return <RouterProvider router={router} />;
}

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <AuthProvider>
        <AccessProvider>
        <UsageProvider>
          <AuthGate />
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: "var(--card)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
                fontSize: "13px",
                padding: "12px 16px",
                borderRadius: "10px",
                boxShadow: "0 4px 16px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)",
              },
              /* Enhanced type differentiation */
              success: {
                style: {
                  border: "1px solid rgba(26, 122, 109, 0.3)",
                  background: "rgba(26, 122, 109, 0.04)",
                },
                icon: "✓",
              },
              error: {
                style: {
                  border: "1px solid rgba(196, 64, 64, 0.3)",
                  background: "rgba(196, 64, 64, 0.04)",
                },
                icon: "✕",
              },
              warning: {
                style: {
                  border: "1px solid rgba(200, 137, 58, 0.3)",
                  background: "rgba(200, 137, 58, 0.04)",
                },
                icon: "⚠",
              },
              loading: {
                icon: "⏳",
                style: {
                  border: "1px solid var(--border)",
                },
              },
            }}
            /* Enhanced UX settings */
            closeButton
            duration={3000}
            expand={false}
            richColors={false}
          />
        </UsageProvider>
        </AccessProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}