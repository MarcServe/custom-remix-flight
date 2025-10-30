import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Companies from "./pages/Companies";
import Deals from "./pages/Deals";
import People from "./pages/People";
import LeadFinder from "./pages/LeadFinder";
import Pipeline from "./pages/Pipeline";
import Sequences from "./pages/Sequences";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <div className="flex h-screen">
          <Sidebar />
          <main className="flex-1 overflow-auto bg-gradient-to-br from-background to-muted/20 p-8">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/companies" element={<Companies />} />
              <Route path="/deals" element={<Deals />} />
              <Route path="/people" element={<People />} />
              <Route path="/lead-finder" element={<LeadFinder />} />
              <Route path="/pipeline" element={<Pipeline />} />
              <Route path="/sequences" element={<Sequences />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
