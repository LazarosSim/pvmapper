import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { SupabaseProvider } from "@/lib/supabase-provider";
import { DBProvider } from "@/lib/db-provider";
import { SyncProvider } from "@/lib/local/sync-provider";
import AuthGuard from "@/components/auth/auth-guard";
import ScrollToTop from "@/components/ScrollToTop";
import Index from "./pages/Index";
import ParkDetail from "./pages/ParkDetail";
import RowDetail from "./pages/RowDetail";
import ScanPage from "./pages/ScanPage";
import ScanParkPage from "./pages/ScanParkPage";
import ScanRowPage from "./pages/ScanRowPage";
import ProfilePage from "./pages/ProfilePage";
import LoginPage from "./pages/LoginPage";
import SearchPage from "./pages/SearchPage";
import NotFound from "./pages/NotFound";

// Managers only, and heavy (charts): loaded when opened
const DashboardPage = lazy(() => import("./pages/DashboardPage"));

// Park, row and barcode data live in the phone's own database (src/lib/local);
// React Query only caches server-only views (statistics, archived parks, search).
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30000,
    },
  },
});

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <SupabaseProvider>
            <DBProvider>
              <SyncProvider>
                <ScrollToTop />
                <Toaster />
                <Sonner />
                <Routes>
                  {/* Public route */}
                  <Route path="/login" element={<LoginPage />} />

                  {/* Protected routes */}
                  <Route path={"/"} element={<AuthGuard><Index /></AuthGuard>} />
                  <Route path="/park/:parkId" element={<AuthGuard><ParkDetail /></AuthGuard>} />
                  <Route path="/row/:rowId" element={<AuthGuard><RowDetail /></AuthGuard>} />
                  <Route path="/scan" element={<AuthGuard><ScanPage /></AuthGuard>} />
                  <Route path="/scan/park/:parkId" element={<AuthGuard><ScanParkPage /></AuthGuard>} />
                  <Route path="/scan/row/:rowId" element={<AuthGuard><ScanRowPage /></AuthGuard>} />
                  <Route path="/search" element={<AuthGuard><SearchPage /></AuthGuard>} />
                  <Route path="/profile" element={<AuthGuard><ProfilePage /></AuthGuard>} />

                  {/* Manager-only route */}
                  <Route
                    path="/dashboard"
                    element={
                      <AuthGuard requireManager={true}>
                        <Suspense fallback={null}>
                          <DashboardPage />
                        </Suspense>
                      </AuthGuard>
                    }
                  />

                  <Route path="*" element={<NotFound />} />
                </Routes>
              </SyncProvider>
            </DBProvider>
          </SupabaseProvider>
        </BrowserRouter>
      </TooltipProvider>
      <ReactQueryDevtools />
    </QueryClientProvider>
  );
};

export default App;
