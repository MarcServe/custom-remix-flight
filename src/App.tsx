import { Analytics } from "@vercel/analytics/react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { QUERY_CACHE_KEY } from "@/lib/localPersistence";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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
import HospitalityLeads from "./pages/HospitalityLeads";
import Autopilot from "./pages/Autopilot";
import LeadInbox from "./pages/LeadInbox";
import Enrichment from "./pages/Enrichment";
import BusinessProfile from "./pages/BusinessProfile";
import ApiKeys from "./pages/ApiKeys";
import ConnectAI from "./pages/ConnectAI";
import AiCreate from "./pages/AiCreate";
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
import Admin from "./pages/Admin";
import EmailBranding from "./pages/EmailBranding";
import Newsletters from "./pages/Newsletters";
import NewsletterSeries from "./pages/NewsletterSeries";
import RecipientGroups from "./pages/RecipientGroups";
import NotFound from "./pages/NotFound";

// Keep fetched data for a day so a refresh or Back shows the page instantly from the browser
// cache, then refreshes in the background (staleTime 0 = always revalidate on mount).
const CACHE_MAX_AGE = 1000 * 60 * 60 * 24;
const queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: CACHE_MAX_AGE } } });

// localStorage holds ~5 MB: skip the biggest datasets and anything over ~400 KB.
const NEVER_PERSIST = new Set(["companies-full", "companies-filtered-full", "people-full", "email-threads", "conversations"]);
const sizeOf = new WeakMap<object, number>();
const persistable = (data: unknown) => {
  if (data == null || typeof data !== "object") return true;
  let n = sizeOf.get(data as object);
  if (n === undefined) { try { n = JSON.stringify(data).length; } catch { n = Infinity; } sizeOf.set(data as object, n); }
  return n < 400_000;
};
const persister = typeof window !== "undefined"
  ? createSyncStoragePersister({ storage: window.localStorage, key: QUERY_CACHE_KEY, throttleTime: 2000 })
  : undefined;

// Component to handle realtime subscriptions and notifications
const RealtimeProvider = ({ children }: { children: React.ReactNode }) => {
  useAllRealtime();
  useAllEmailNotifications();
  return <>{children}</>;
};

const App = () => (
  <PersistQueryClientProvider
    client={queryClient}
    persistOptions={{
      persister: persister!,
      maxAge: CACHE_MAX_AGE,
      buster: "lb-cache-v1",
      dehydrateOptions: {
        shouldDehydrateQuery: (q) =>
          q.state.status === "success" && !NEVER_PERSIST.has(String(q.queryKey[0])) && persistable(q.state.data),
      },
    }}
  >
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
                        <main className="flex-1 overflow-auto overflow-x-hidden bg-gradient-to-br from-background to-muted/20 p-3 pt-16 sm:p-4 sm:pt-16 xl:pt-6 xl:p-6 2xl:p-8 min-w-0 pb-[max(5rem,env(safe-area-inset-bottom))] sm:pb-6 transition-[flex] duration-300">
                          <div className="max-w-full min-w-0 animate-enter">
                          <Routes>
                          <Route path="/" element={<Dashboard />} />
                          <Route path="/companies" element={<Companies />} />
                          <Route path="/deals" element={<Deals />} />
                          <Route path="/people" element={<People />} />
                          {/* Pro tier routes */}
                          <Route path="/lead-finder" element={<PageErrorBoundary fallbackTitle="Lead Finder failed to load"><PlanGate requiredTier="pro" feature="Lead Finder"><LeadFinder /></PlanGate></PageErrorBoundary>} />
                          <Route path="/hospitality-leads" element={<PageErrorBoundary fallbackTitle="Hospitality Leads failed to load"><PlanGate requiredTier="pro" feature="Hospitality Leads"><HospitalityLeads /></PlanGate></PageErrorBoundary>} />
                          <Route path="/lead-inbox" element={<PlanGate requiredTier="pro" feature="Lead Inbox"><LeadInbox /></PlanGate>} />
                          <Route path="/sequences" element={<PlanGate requiredTier="pro" feature="Email Sequences"><Sequences /></PlanGate>} />
                          <Route path="/company-sequences" element={<PlanGate requiredTier="pro" feature="Company Sequences"><CompanySequences /></PlanGate>} />
                          <Route path="/newsletter-series" element={<PlanGate requiredTier="pro" feature="Newsletter Series"><NewsletterSeries /></PlanGate>} />
                          {/* More specific path first */}
                          <Route path="/campaigns/import-email" element={<PlanGate requiredTier="pro" feature="Per-recipient Personalised Email"><PersonalizedEmailCampaign /></PlanGate>} />
                          <Route path="/all-campaigns" element={<PlanGate requiredTier="pro" feature="Unified Campaigns"><UnifiedCampaigns /></PlanGate>} />
                          {/* LeadBoosters tier routes */}
                          <Route path="/enrichment" element={<PlanGate requiredTier="leadboosters" feature="Company Enrichment"><Enrichment /></PlanGate>} />
                          <Route path="/autopilot" element={<PlanGate requiredTier="leadboosters" feature="Autopilot"><Autopilot /></PlanGate>} />
                          <Route path="/auto-responses" element={<PlanGate requiredTier="leadboosters" feature="Auto-Response Hub"><AutoResponseHub /></PlanGate>} />
                          {/* Individual tier routes */}
                          <Route path="/ai-create" element={<PlanGate requiredTier="individual" feature="Create with AI"><AiCreate /></PlanGate>} />
                          <Route path="/campaigns" element={<PlanGate requiredTier="individual" feature="Email Campaigns"><Campaigns /></PlanGate>} />
                          <Route path="/newsletters" element={<PlanGate requiredTier="individual" feature="Newsletters"><Newsletters /></PlanGate>} />
                          <Route path="/business-profile" element={<BusinessProfile />} />
                          <Route path="/api-keys" element={<ApiKeys />} />
                          <Route path="/connect-ai" element={<ConnectAI />} />
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
                          <Route path="/admin" element={<PageErrorBoundary fallbackTitle="Admin failed to load"><Admin /></PageErrorBoundary>} />
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
  </PersistQueryClientProvider>
);

export default function AppWithAnalytics() {
  return (
    <>
      <App />
      <Analytics />
    </>
  );
}
