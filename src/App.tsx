import { Analytics } from "@vercel/analytics/react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ResearchChatProvider } from "./contexts/ResearchChatContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { PageErrorBoundary } from "./components/PageErrorBoundary";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { TrialGate } from "./components/TrialGate";
import { PlanGate } from "./components/PlanGate";
import { CampaignDialogProvider } from "./contexts/CampaignDialogContext";
import { GlobalCampaignDialog } from "./components/GlobalCampaignDialog";
import { Sidebar } from "./components/Sidebar";
import { ResearchChatSlideOut } from "./components/ResearchChatSlideOut";
import { useAllRealtime } from "./hooks/use-realtime";
import { useAllEmailNotifications } from "./hooks/use-email-notifications";
import Dashboard from "./pages/Dashboard";
import Companies from "./pages/Companies";
import Deals from "./pages/Deals";
import People from "./pages/People";
import LeadFinder from "./pages/LeadFinder";
import Autopilot from "./pages/Autopilot";
import LeadInbox from "./pages/LeadInbox";
import Enrichment from "./pages/Enrichment";
import BusinessProfile from "./pages/BusinessProfile";
import Profile from "./pages/Profile";
import Pipeline from "./pages/Pipeline";
import Sequences from "./pages/Sequences";
import CompanySequences from "./pages/CompanySequences";
import Campaigns from "./pages/Campaigns";
import PersonalizedEmailCampaign from "./pages/PersonalizedEmailCampaign";
import Notes from "./pages/Notes";
import UnifiedCampaigns from "./pages/UnifiedCampaigns";
import AutoResponseHub from "./pages/AutoResponseHub";
import Conversations from "./pages/Conversations";
import Events from "./pages/Events";
import Integrations from "./pages/Integrations";
import EmailProviders from "./pages/EmailProviders";
import EmailDeliverability from "./pages/EmailDeliverability";
import Teams from "./pages/Teams";
import SharedInbox from "./pages/SharedInbox";
import Files from "./pages/Files";
import Invoices from "./pages/Invoices";
import Auth from "./pages/Auth";
import Subscription from "./pages/Subscription";
import EmailBranding from "./pages/EmailBranding";
import Newsletters from "./pages/Newsletters";
import NewsletterSeries from "./pages/NewsletterSeries";
import RecipientGroups from "./pages/RecipientGroups";
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
            <ErrorBoundary>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <CampaignDialogProvider>
                    <ResearchChatProvider>
                      <div className="flex h-screen overflow-hidden">
                        <Sidebar />
                        <GlobalCampaignDialog />
                        <main className="flex-1 overflow-auto overflow-x-hidden bg-gradient-to-br from-background to-muted/20 p-4 pt-16 lg:pt-6 lg:p-6 xl:p-8 min-w-0 pb-20 sm:pb-6 transition-[flex] duration-300">
                          <div className="max-w-full min-w-0 animate-enter">
                          <Routes>
                          <Route path="/" element={<Dashboard />} />
                          <Route path="/companies" element={<Companies />} />
                          <Route path="/deals" element={<Deals />} />
                          <Route path="/people" element={<People />} />
                          {/* Pro tier routes */}
                          <Route path="/lead-finder" element={<PageErrorBoundary fallbackTitle="Lead Finder failed to load"><PlanGate requiredTier="pro" feature="Lead Finder"><LeadFinder /></PlanGate></PageErrorBoundary>} />
                          <Route path="/lead-inbox" element={<PlanGate requiredTier="pro" feature="Lead Inbox"><LeadInbox /></PlanGate>} />
                          <Route path="/sequences" element={<PlanGate requiredTier="pro" feature="Email Sequences"><Sequences /></PlanGate>} />
                          <Route path="/company-sequences" element={<PlanGate requiredTier="pro" feature="Company Sequences"><CompanySequences /></PlanGate>} />
                          <Route path="/newsletter-series" element={<PageErrorBoundary fallbackTitle="Newsletter Series failed to load"><PlanGate requiredTier="pro" feature="Newsletter Series"><NewsletterSeries /></PlanGate></PageErrorBoundary>} />
                          {/* More specific path first */}
                          <Route path="/campaigns/import-email" element={<PlanGate requiredTier="pro" feature="Per-recipient Personalised Email"><PersonalizedEmailCampaign /></PlanGate>} />
                          <Route path="/all-campaigns" element={<PlanGate requiredTier="pro" feature="Unified Campaigns"><UnifiedCampaigns /></PlanGate>} />
                          {/* LeadBoosters tier routes */}
                          <Route path="/enrichment" element={<PlanGate requiredTier="leadboosters" feature="Company Enrichment"><Enrichment /></PlanGate>} />
                          <Route path="/autopilot" element={<PlanGate requiredTier="leadboosters" feature="Autopilot"><Autopilot /></PlanGate>} />
                          <Route path="/auto-responses" element={<PlanGate requiredTier="leadboosters" feature="Auto-Response Hub"><AutoResponseHub /></PlanGate>} />
                          {/* Individual tier routes */}
                          <Route path="/campaigns" element={<PlanGate requiredTier="individual" feature="Email Campaigns"><Campaigns /></PlanGate>} />
                          <Route path="/newsletters" element={<PlanGate requiredTier="individual" feature="Newsletters"><Newsletters /></PlanGate>} />
                          <Route path="/business-profile" element={<BusinessProfile />} />
                          <Route path="/profile" element={<Profile />} />
                          <Route path="/pipeline" element={<Pipeline />} />
                          <Route path="/email-branding" element={<PageErrorBoundary fallbackTitle="Email Branding failed to load"><EmailBranding /></PageErrorBoundary>} />
                          <Route path="/recipient-groups" element={<RecipientGroups />} />
                          <Route path="/notes" element={<Notes />} />
                          <Route path="/conversations" element={<PageErrorBoundary fallbackTitle="Conversations failed to load"><Conversations /></PageErrorBoundary>} />
                          <Route path="/events" element={<Events />} />
                          <Route path="/integrations" element={<Integrations />} />
                          <Route path="/integrations/email-providers" element={<EmailProviders />} />
                          <Route path="/email-deliverability" element={<EmailDeliverability />} />
                          <Route path="/teams" element={<Teams />} />
                          <Route path="/shared-inbox" element={<SharedInbox />} />
                          <Route path="/files" element={<Files />} />
                          <Route path="/invoices" element={<Invoices />} />
                          <Route path="/subscription" element={<Subscription />} />
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                          </div>
                        </main>
                      </div>
                      <ResearchChatSlideOut />
                    </ResearchChatProvider>
                    </CampaignDialogProvider>
                  </ProtectedRoute>
                }
              />
            </Routes>
            </ErrorBoundary>
          </RealtimeProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default function AppWithAnalytics() {
  return (
    <>
      <App />
      <Analytics />
    </>
  );
}
