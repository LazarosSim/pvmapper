import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { DBProvider } from "@/lib/db-provider";
import { SupabaseProvider } from "@/lib/supabase-provider";
import AuthGuard from "@/components/auth/auth-guard";
import Index from "./pages/Index";
import ParkDetail from "./pages/ParkDetail";
import RowDetail from "./pages/RowDetail";
import ScanPage from "./pages/ScanPage";
import ScanParkPage from "./pages/ScanParkPage";
import ScanRowPage from "./pages/ScanRowPage";
import ProfilePage from "./pages/ProfilePage";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <SupabaseProvider>
        <DBProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Public route */}
              <Route path="/login" element={<LoginPage />} />
              
              {/* Protected routes */}
              <Route path="/" element={<AuthGuard><Index /></AuthGuard>} />
              <Route path="/park/:parkId" element={<AuthGuard><ParkDetail /></AuthGuard>} />
              <Route path="/row/:rowId" element={<AuthGuard><RowDetail /></AuthGuard>} />
              <Route path="/scan" element={<AuthGuard><ScanPage /></AuthGuard>} />
              <Route path="/scan/park/:parkId" element={<AuthGuard><ScanParkPage /></AuthGuard>} />
              <Route path="/scan/row/:rowId" element={<AuthGuard><ScanRowPage /></AuthGuard>} />
              <Route path="/profile" element={<AuthGuard><ProfilePage /></AuthGuard>} />
              
              {/* Manager-only route */}
              <Route path="/dashboard" element={<AuthGuard requireManager={true}><DashboardPage /></AuthGuard>} />
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </DBProvider>
      </SupabaseProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
