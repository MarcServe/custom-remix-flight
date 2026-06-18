import { useState, useEffect } from "react";
import { Building2, Users, DollarSign, BarChart3, Mail, Sparkles, TrendingUp, LogOut, User, Activity, Briefcase, ChevronLeft, ChevronRight, Calendar, CalendarClock, Plug2, Menu, X, MessageSquare, Shield, Zap, ChevronDown, Send, Settings, Search, FileText, FileSpreadsheet, FolderOpen, CreditCard, Inbox, Brain, Wand2, StickyNote, Palette, Newspaper, UsersRound, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth, PlanTier, TIER_RANK, PLAN_LABELS } from "@/contexts/AuthContext";
import { useResearchChat } from "@/contexts/ResearchChatContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { usePendingCounts } from "@/hooks/use-pending-counts";
import { useEventsRealtime, useDealsRealtimeForNotifications, useCampaignsRealtimeForNotifications } from "@/hooks/use-realtime";
import { supabase } from "@/integrations/supabase/client";
import { usePendingReviewsCount } from "@/hooks/use-pending-reviews";
import { ActivityNotificationCenter } from "@/components/notifications/ActivityNotificationCenter";
import leadBoostersLogo from '@/assets/leadboosters-logo.png';

type NavigationItem = {
  name: string;
  href: string;
  icon: any;
  children?: (NavigationItem & { opensResearchPanel?: boolean })[];
};

const navigation: NavigationItem[] = [
  // CORE
  { name: "Dashboard", href: "/", icon: BarChart3 },
  { name: "Companies", href: "/companies", icon: Building2 },
  { name: "People", href: "/people", icon: Users },
  { name: "Deals", href: "/deals", icon: DollarSign },
  { name: "Pipeline", href: "/pipeline", icon: TrendingUp },
  
  // LEAD GENERATION
  { 
    name: "Lead Generation", 
    href: "#leads", 
    icon: Search,
    children: [
      { name: "Autopilot", href: "/autopilot", icon: Brain },
      { name: "Lead Finder", href: "/lead-finder", icon: Sparkles },
      { name: "Research Chat", href: "#", icon: MessageSquare, opensResearchPanel: true },
      { name: "Enrichment", href: "/enrichment", icon: Wand2 },
      { name: "Lead Inbox", href: "/lead-inbox", icon: Inbox },
    ]
  },
  
  // OUTREACH
  { 
    name: "Outreach", 
    href: "#outreach", 
    icon: Send,
    children: [
      // First so it stays visible without scrolling; same as /campaigns/import-email
      { name: "Personalized emails", href: "/campaigns/import-email", icon: FileSpreadsheet },
      { name: "Sequences", href: "/sequences", icon: Mail },
      { name: "Active Campaigns", href: "/company-sequences", icon: Activity },
      { name: "Campaigns", href: "/campaigns", icon: Briefcase },
      { name: "Email Branding", href: "/email-branding", icon: Palette },
      { name: "Newsletters", href: "/newsletters", icon: Newspaper },
      // Newsletter Series retired from the UI (backend kept). Re-add this entry to restore it.
      { name: "Recipient Groups", href: "/recipient-groups", icon: UsersRound },
      { name: "Notes", href: "/notes", icon: StickyNote },
    ]
  },
  
  // CONVERSATIONS
  { name: "Conversations", href: "/conversations", icon: MessageSquare },
  { name: "Auto-Responses", href: "/auto-responses", icon: Sparkles },
  
  // ORGANIZATION
  { 
    name: "Organization", 
    href: "#organization", 
    icon: FolderOpen,
    children: [
      { name: "Events", href: "/events", icon: Calendar },
      { name: "Invoices", href: "/invoices", icon: FileText },
      { name: "Files", href: "/files", icon: FolderOpen },
    ]
  },
  
  // COLLABORATION
  { 
    name: "Collaboration", 
    href: "#collaboration", 
    icon: Users,
    children: [
      { name: "Teams", href: "/teams", icon: Users },
      { name: "Shared Inbox", href: "/shared-inbox", icon: Inbox },
    ]
  },
  
  // SETTINGS
  { 
    name: "Settings", 
    href: "#settings", 
    icon: Settings,
    children: [
      { name: "Email Providers", href: "/integrations/email-providers", icon: Send },
      { name: "Business Profile", href: "/business-profile", icon: Building2 },
      { name: "Subscription", href: "/subscription", icon: CreditCard },
    ]
  },
];

// Minimum plan tier required for each nav route
const ROUTE_TIER: Record<string, PlanTier> = {
  // Individual tier
  '/campaigns':             'individual',
  '/newsletters':           'individual',
  // Pro tier
  '/lead-finder':           'pro',
  '/lead-inbox':            'pro',
  '/sequences':             'pro',
  '/company-sequences':     'pro',
  '/newsletter-series':     'pro',
  '/campaigns/import-email':'pro',
  '/all-campaigns':         'pro',
  // LeadBoosters tier
  '/enrichment':            'leadboosters',
  '/autopilot':             'leadboosters',
  '/auto-responses':        'leadboosters',
};

const TIER_BADGE_CLASS: Record<'individual' | 'pro' | 'leadboosters', string> = {
  individual:   'bg-sky-100 text-sky-700 border-sky-300 dark:bg-sky-950 dark:text-sky-400',
  pro:          'bg-violet-100 text-violet-700 border-violet-300 dark:bg-violet-950 dark:text-violet-400',
  leadboosters: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-400',
};

const TIER_SHORT: Record<'individual' | 'pro' | 'leadboosters', string> = {
  individual:   'IND',
  pro:          'PRO',
  leadboosters: 'LB',
};

// Helper function to get pending count for a menu item
const getPendingCount = (href: string, pendingCounts: any, pendingReviewsCount?: number) => {
  if (!pendingCounts) return 0;
  if (href === '/deals') return pendingCounts.deals;
  if (href === '/sequences') return pendingCounts.sequences;
  if (href === '/company-sequences') return pendingCounts.campaigns;
  if (href === '/events') return pendingCounts.events;
  if (href === '/conversations' && pendingReviewsCount) return pendingReviewsCount;
  return 0;
};

export const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut, planTier } = useAuth();

  // Returns true if the user's current plan can access the given route
  const canAccess = (href: string) => {
    const required = ROUTE_TIER[href];
    if (!required) return true; // no restriction
    return TIER_RANK[planTier] >= TIER_RANK[required];
  };
  const { setOpen: openResearchPanel } = useResearchChat();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { data: pendingCounts } = usePendingCounts();
  const { data: pendingReviewsCount } = usePendingReviewsCount();
  const [activeSearch, setActiveSearch] = useState<any>(null);
  
  // Enable real-time updates for notifications
  useEventsRealtime();
  useDealsRealtimeForNotifications();
  useCampaignsRealtimeForNotifications();

  // Check for active lead searches
  useEffect(() => {
    const checkActiveSearch = async () => {
      if (!user) return;

      const { data: searches } = await supabase
        .from('lead_finder_searches')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'running')
        .order('created_at', { ascending: false })
        .limit(1);

      if (searches && searches.length > 0) {
        setActiveSearch(searches[0]);
      } else {
        setActiveSearch(null);
      }
    };

    checkActiveSearch();

    // Setup realtime subscription for active searches
    const channel = supabase
      .channel('active_searches')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lead_finder_searches',
          filter: `user_id=eq.${user?.id}`,
        },
        (payload) => {
          const newSearch = payload.new as any;
          const oldSearch = payload.old as any;

          if (payload.eventType === 'UPDATE' && oldSearch?.status === 'running' && newSearch?.status === 'complete') {
            // Search completed - show notification if not on lead finder page
            if (location.pathname !== '/lead-finder') {
              const leadsCount = (newSearch.stats as any)?.totalFound || 0;
              // Use toast from context or create a simple notification
              const notification = document.createElement('div');
              notification.className = 'fixed bottom-4 right-4 bg-card border rounded-lg shadow-lg p-4 max-w-sm z-50 animate-in slide-in-from-bottom-5';
              notification.innerHTML = `
                <div class="flex items-start gap-3">
                  <div class="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <svg class="h-4 w-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                  <div class="flex-1">
                    <h4 class="text-sm font-semibold mb-1">Lead Search Complete</h4>
                    <p class="text-xs text-muted-foreground mb-2">Found ${leadsCount} companies</p>
                    <button onclick="window.location.href='/lead-finder'" class="text-xs text-primary hover:underline font-medium">
                      View Results →
                    </button>
                  </div>
                  <button onclick="this.parentElement.parentElement.remove()" class="text-muted-foreground hover:text-foreground">
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                  </button>
                </div>
              `;
              document.body.appendChild(notification);
              setTimeout(() => notification.remove(), 8000);
            }
            setActiveSearch(null);
          } else if (newSearch && newSearch.status === 'running') {
            setActiveSearch(newSearch);
          } else if (payload.eventType === 'DELETE' || newSearch?.status !== 'running') {
            setActiveSearch(null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, location.pathname]);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

  // Close mobile menu on window resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getUserInitials = () => {
    if (!user?.email) return 'U';
    return user.email.charAt(0).toUpperCase();
  };

  const getUserDisplayName = () => {
    if (user?.user_metadata?.full_name) {
      return user.user_metadata.full_name;
    }
    return user?.email || 'User';
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-3 left-3 z-[60] lg:hidden bg-background/95 backdrop-blur-sm border shadow-md"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
      >
        {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-[55] lg:hidden backdrop-blur-sm"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar - collapse only minimizes width; page content on the right stays open */}
      <aside
        data-sidebar="main"
        role="navigation"
        aria-label="Main navigation"
        className={cn(
          "flex h-full flex-col border-r bg-card transition-[width] duration-300 shrink-0",
          "fixed lg:relative inset-y-0 left-0 z-[56]",
          isCollapsed ? "w-16" : "w-[280px] sm:w-64",
          // Mobile: hidden by default, slide in when open
          isMobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex h-16 items-center border-b px-3 justify-between min-w-0">
        {!isCollapsed && (
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <img src={leadBoostersLogo} alt="LeadBoosters CRM" className="h-10 w-auto" />
          </div>
        )}
        {isCollapsed && (
          <div className="flex justify-center w-full flex-1 min-w-0">
            <img src={leadBoostersLogo} alt="LeadBoosters CRM" className="h-8 w-auto" />
          </div>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 hidden md:flex"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsCollapsed((c) => !c);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>
      
      {/* Global Search Indicator */}
      {activeSearch && (
        <div 
          className={cn(
            "mx-3 mt-4 p-3 rounded-lg bg-primary/10 border border-primary/20 transition-colors group",
            isCollapsed && "p-2"
          )}
        >
          {isCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div 
                  className="flex justify-center cursor-pointer"
                  onClick={() => navigate('/lead-finder')}
                >
                  <Search className="h-5 w-5 text-primary animate-pulse" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">
                <div className="space-y-1">
                  <p className="font-semibold">Lead search in progress</p>
                  <p className="text-xs">{activeSearch.progress}% complete</p>
                  <p className="text-xs text-muted-foreground">{activeSearch.current_status}</p>
                </div>
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-primary animate-pulse" />
                  <span className="text-sm font-medium text-primary">Lead Search Active</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                  onClick={async (e) => {
                    e.stopPropagation();
                    await supabase
                      .from('lead_finder_searches')
                      .update({ status: 'paused' })
                      .eq('id', activeSearch.id);
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="truncate">{activeSearch.current_status}</span>
                  <span className="font-mono">{activeSearch.progress}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${activeSearch.progress}%` }}
                  />
                </div>
              </div>
              <button
                onClick={() => navigate('/lead-finder')}
                className="w-full text-xs text-primary hover:underline text-left font-medium"
              >
                View Details →
              </button>
            </div>
          )}
        </div>
      )}
      
      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
        {navigation.map((item) => {
          const currentFullPath = location.pathname + location.search;
          const matchesHref = (href: string) => {
            if (href.includes('?')) return currentFullPath === href || (location.pathname + location.search) === href;
            return location.pathname === href;
          };
          const isGroupActive = item.children?.some(child => matchesHref(child.href)) || false;
          const isActive = matchesHref(item.href);
          
          // Render parent item with children (collapsible group)
          if (item.children) {
            return (
              <Collapsible key={item.name} defaultOpen={isGroupActive}>
                <CollapsibleTrigger asChild>
                  <button
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                      isGroupActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      isCollapsed && "justify-center"
                    )}
                  >
                    <item.icon className={cn("h-4 w-4 shrink-0", isGroupActive && "text-primary")} />
                    {!isCollapsed && (
                      <>
                        <span className="flex-1 text-left tracking-wide uppercase text-[10px] font-bold">{item.name}</span>
                        <ChevronDown className={cn(
                          "h-3.5 w-3.5 transition-transform duration-200",
                          isGroupActive && "rotate-180 text-primary"
                        )} />
                      </>
                    )}
                  </button>
                </CollapsibleTrigger>
                {!isCollapsed && (
                  <CollapsibleContent>
                    <div className="mt-0.5 ml-3 pl-3 border-l-2 border-primary/20 space-y-0.5 pb-1">
                    {item.children.map((child) => {
                      const isChildActive = matchesHref(child.href);

                      // Get pending count for child items
                      let pendingCount = 0;
                      if (pendingCounts) {
                        if (child.href === '/deals') pendingCount = pendingCounts.deals;
                        else if (child.href === '/sequences') pendingCount = pendingCounts.sequences;
                        else if (child.href === '/company-sequences') pendingCount = pendingCounts.campaigns;
                        else if (child.href === '/events') pendingCount = pendingCounts.events;
                      }

                      const childClassName = cn(
                        "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors relative w-full",
                        isChildActive
                          ? "bg-primary text-primary-foreground font-medium shadow-sm"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      );

                      if (child.opensResearchPanel) {
                        return (
                          <button
                            key={child.name}
                            type="button"
                            onClick={() => openResearchPanel(true)}
                            className={childClassName}
                          >
                            <child.icon className="h-3.5 w-3.5 shrink-0" />
                            <span className="flex-1 text-left">{child.name}</span>
                          </button>
                        );
                      }

                      const requiredTier = ROUTE_TIER[child.href] as ('individual' | 'pro' | 'leadboosters') | undefined;
                      const locked = requiredTier && !canAccess(child.href);

                      return (
                        <Link
                          key={child.name}
                          to={child.href}
                          className={cn(childClassName, locked && "opacity-60")}
                          title={locked ? `Requires ${PLAN_LABELS[requiredTier!]} plan` : undefined}
                        >
                          {locked
                            ? <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            : <child.icon className="h-3.5 w-3.5 shrink-0" />}
                          <span className="flex-1">{child.name}</span>
                          {locked && requiredTier && (
                            <span className={`inline-flex items-center rounded border px-1 py-0.5 text-[9px] font-bold leading-none ${TIER_BADGE_CLASS[requiredTier]}`}>
                              {TIER_SHORT[requiredTier]}
                            </span>
                          )}
                          {!locked && pendingCount > 0 && (
                            <Badge
                              variant="secondary"
                              className="h-4 min-w-4 px-1 text-[10px] font-semibold bg-destructive text-destructive-foreground animate-pulse"
                            >
                              {pendingCount > 99 ? '99+' : pendingCount}
                            </Badge>
                          )}
                        </Link>
                      );
                    })}
                    </div>
                  </CollapsibleContent>
                )}
              </Collapsible>
            );
          }
          
          // Render regular navigation item
          const pendingCount = getPendingCount(item.href, pendingCounts, pendingReviewsCount);
          const topLevelRequiredTier = ROUTE_TIER[item.href] as ('individual' | 'pro' | 'leadboosters') | undefined;
          const topLevelLocked = topLevelRequiredTier && !canAccess(item.href);

          const linkContent = (
            <Link
              key={item.name}
              to={item.href}
              title={topLevelLocked ? `Requires ${PLAN_LABELS[topLevelRequiredTier!]} plan` : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors relative",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                isCollapsed && "justify-center",
                topLevelLocked && "opacity-60"
              )}
            >
              {topLevelLocked
                ? <Lock className="h-5 w-5 shrink-0" />
                : <item.icon className="h-5 w-5 shrink-0" />}
              {!isCollapsed && <span className="flex-1">{item.name}</span>}
              {!isCollapsed && topLevelLocked && topLevelRequiredTier && (
                <span className={`inline-flex items-center rounded border px-1 py-0.5 text-[9px] font-bold leading-none ${TIER_BADGE_CLASS[topLevelRequiredTier]}`}>
                  {TIER_SHORT[topLevelRequiredTier]}
                </span>
              )}
              {!topLevelLocked && pendingCount > 0 && !isCollapsed && (
                <Badge
                  variant="secondary"
                  className="h-5 min-w-5 px-1 text-xs font-semibold bg-destructive text-destructive-foreground animate-pulse"
                >
                  {pendingCount > 99 ? '99+' : pendingCount}
                </Badge>
              )}
              {!topLevelLocked && pendingCount > 0 && isCollapsed && (
                <span className="absolute -top-1 -right-1 h-3 w-3 bg-destructive rounded-full border-2 border-sidebar animate-pulse" />
              )}
            </Link>
          );

          if (isCollapsed) {
            return (
              <Tooltip key={item.name} delayDuration={0}>
                <TooltipTrigger asChild>
                  {linkContent}
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>{item.name}</p>
                </TooltipContent>
              </Tooltip>
            );
          }

          return linkContent;
        })}
      </nav>
      
      {/* Activity Notifications */}
      <div className="border-t p-3">
        <div className="flex items-center justify-center">
          <ActivityNotificationCenter />
        </div>
      </div>
      
      {user && (
        <div className="border-t p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                className={cn(
                  "w-full h-auto p-3 hover:bg-muted",
                  isCollapsed ? "justify-center" : "justify-start gap-3"
                )}
                onClick={(e) => {
                  // Prevent any parent click handlers from interfering
                  e.stopPropagation();
                }}
              >
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
                {!isCollapsed && (
                  <div className="flex flex-col items-start text-sm flex-1 min-w-0">
                    <span className="font-medium truncate w-full">{getUserDisplayName()}</span>
                    <span className="text-xs text-muted-foreground truncate w-full">
                      {user.email}
                    </span>
                  </div>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              align={isCollapsed ? "center" : "end"} 
              side={isCollapsed ? "right" : "top"}
              className="w-56 !z-[9999]"
              sideOffset={8}
              alignOffset={isCollapsed ? 0 : -10}
            >
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/profile" className="cursor-pointer flex items-center w-full">
                  <User className="mr-2 h-4 w-4" />
                  Profile Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/business-profile" className="cursor-pointer flex items-center w-full">
                  <Building2 className="mr-2 h-4 w-4" />
                  Business Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="text-destructive cursor-pointer">
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
      </aside>
    </>
  );
};
