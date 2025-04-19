
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DBProvider } from "@/lib/db-provider";
import Index from "./pages/Index";
import ParkDetail from "./pages/ParkDetail";
import RowDetail from "./pages/RowDetail";
import ScanPage from "./pages/ScanPage";
import SearchPage from "./pages/SearchPage";
import BackupPage from "./pages/BackupPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <DBProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/park/:parkId" element={<ParkDetail />} />
            <Route path="/row/:rowId" element={<RowDetail />} />
            <Route path="/scan" element={<ScanPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/backup" element={<BackupPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </DBProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
