import {Toaster} from "@/components/ui/toaster";
import {Toaster as Sonner} from "@/components/ui/sonner";
import {TooltipProvider} from "@/components/ui/tooltip";
import {ReactQueryDevtools} from '@tanstack/react-query-devtools';
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {BrowserRouter, Route, Routes} from "react-router-dom";
import {SupabaseProvider} from "@/lib/supabase-provider";
import {DBProvider} from "@/lib/db-provider";
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
import DashboardPage from "./pages/DashboardPage";
import NotFound from "./pages/NotFound";
import {persistQueryClient,} from '@tanstack/react-query-persist-client'
import {createSyncStoragePersister} from '@tanstack/query-sync-storage-persister'


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
    },
  },
});

const persister = createSyncStoragePersister({storage: window.localStorage})

persistQueryClient({
  queryClient,
  persister,
  maxAge: Infinity
})


const _origFetch = window.fetch;
window.fetch = (...args) => {
  console.log('[PAGE fetch]', args[0], args[1]?.method || 'GET');
  return _origFetch(...args);
};

// DEBUG: log every XHR
const _origXhrOpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function (method, url) {
  console.log('[PAGE XHR]', method, url);
  return _origXhrOpen.apply(this, arguments as any);
};


if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker
      .register('/sw.js')
      .then(() => console.log('SW registered'))
      .catch(console.error);
}

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <SupabaseProvider>
            <DBProvider>
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
