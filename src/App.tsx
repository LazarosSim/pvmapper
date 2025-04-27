import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { DBProvider } from "@/lib/db-provider";
import { SupabaseProvider } from "@/lib/supabase-provider";
import AuthGuard from "@/components/auth/auth-guard";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <SupabaseProvider>
        <DBProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<AuthGuard><Index /></AuthGuard>} />
            <Route path="/park/:parkId" element={<AuthGuard><ParkDetail /></AuthGuard>} />
            <Route path="/row/:rowId" element={<AuthGuard><RowDetail /></AuthGuard>} />
            <Route path="/scan" element={<AuthGuard><ScanPage /></AuthGuard>} />
            <Route path="/scan/park/:parkId" element={<AuthGuard><ScanParkPage /></AuthGuard>} />
            <Route path="/scan/row/:rowId" element={<AuthGuard><ScanRowPage /></AuthGuard>} />
            <Route path="/profile" element={<AuthGuard><ProfilePage /></AuthGuard>} />
            <Route path="/dashboard" element={<AuthGuard requireManager={true}><DashboardPage /></AuthGuard>} />
            <Route path="*" element={<NotFound />} />
          </BrowserRouter>
        </DBProvider>
      </SupabaseProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
