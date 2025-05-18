
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import {ReactQueryDevtools} from '@tanstack/react-query-devtools';
import { QueryClient, QueryClientProvider} from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SupabaseProvider } from "@/lib/supabase-provider";
import { DBProvider } from "@/lib/db-provider";
import AuthGuard from "@/components/auth/auth-guard";
import { useState, useEffect } from "react";
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Add a small delay to ensure the app has time to initialize
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <svg className="animate-spin h-10 w-10 text-primary mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-xl font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <SupabaseProvider>
            <DBProvider>
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
                <Route path="/profile" element={<AuthGuard><ProfilePage /></AuthGuard>} />
                
                {/* Manager-only route */}
                <Route path="/dashboard" element={<AuthGuard requireManager={true}><DashboardPage /></AuthGuard>} />
                
                <Route path="*" element={<NotFound />} />
              </Routes>
            </DBProvider>
          </SupabaseProvider>
        </BrowserRouter>
      </TooltipProvider>
      <ReactQueryDevtools/>
    </QueryClientProvider>
  );
};

export default App;
