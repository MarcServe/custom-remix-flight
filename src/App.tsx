import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Sidebar } from "./components/Sidebar";
import { useAllRealtime } from "./hooks/use-realtime";
import { useAllEmailNotifications } from "./hooks/use-email-notifications";
import Dashboard from "./pages/Dashboard";
import Companies from "./pages/Companies";
import Deals from "./pages/Deals";
import People from "./pages/People";
import LeadFinder from "./pages/LeadFinder";
import BusinessProfile from "./pages/BusinessProfile";
import Profile from "./pages/Profile";
import Pipeline from "./pages/Pipeline";
import Sequences from "./pages/Sequences";
import CompanySequences from "./pages/CompanySequences";
import Campaigns from "./pages/Campaigns";
import UnifiedCampaigns from "./pages/UnifiedCampaigns";
import AutoResponseHub from "./pages/AutoResponseHub";
import Conversations from "./pages/Conversations";
import Events from "./pages/Events";
import Integrations from "./pages/Integrations";
import EmailProviders from "./pages/EmailProviders";
import EmailDeliverability from "./pages/EmailDeliverability";
import AutomationRules from "./pages/AutomationRules";
import ABTesting from "./pages/ABTesting";
import Teams from "./pages/Teams";
import SharedInbox from "./pages/SharedInbox";
import Files from "./pages/Files";
import Invoices from "./pages/Invoices";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Component to handle realtime subscriptions and notifications
const RealtimeProvider = ({ children }: { children: React.ReactNode }) => {
  useAllRealtime();
  useAllEmailNotifications();
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <RealtimeProvider>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <div className="flex h-screen overflow-hidden">
                      <Sidebar />
                      <main className="flex-1 overflow-auto bg-gradient-to-br from-background to-muted/20 p-4 pt-16 md:p-6 lg:p-8">
                        <Routes>
                          <Route path="/" element={<Dashboard />} />
                          <Route path="/companies" element={<Companies />} />
                          <Route path="/deals" element={<Deals />} />
                          <Route path="/people" element={<People />} />
                          <Route path="/lead-finder" element={<LeadFinder />} />
                          <Route path="/business-profile" element={<BusinessProfile />} />
                          <Route path="/profile" element={<Profile />} />
                          <Route path="/pipeline" element={<Pipeline />} />
                          <Route path="/sequences" element={<Sequences />} />
                          <Route path="/company-sequences" element={<CompanySequences />} />
          <Route path="/all-campaigns" element={<UnifiedCampaigns />} />
          <Route path="/auto-responses" element={<AutoResponseHub />} />
          <Route path="/campaigns" element={<Campaigns />} />
                          <Route path="/conversations" element={<Conversations />} />
                          <Route path="/events" element={<Events />} />
                          <Route path="/integrations" element={<Integrations />} />
                          <Route path="/integrations/email-providers" element={<EmailProviders />} />
                          <Route path="/email-deliverability" element={<EmailDeliverability />} />
                          <Route path="/automation-rules" element={<AutomationRules />} />
                          <Route path="/ab-testing" element={<ABTesting />} />
                          <Route path="/teams" element={<Teams />} />
                          <Route path="/shared-inbox" element={<SharedInbox />} />
                          <Route path="/files" element={<Files />} />
                          <Route path="/invoices" element={<Invoices />} />
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </main>
                    </div>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </RealtimeProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
