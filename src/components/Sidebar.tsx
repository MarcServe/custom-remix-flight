import { useState, useEffect } from "react";
import { Building2, Users, DollarSign, BarChart3, Mail, Sparkles, TrendingUp, LogOut, User, Activity, Briefcase, ChevronLeft, ChevronRight, Calendar, Plug2, Menu, X, MessageSquare, Shield, Zap, ChevronDown, Send, Settings, Search, FileText, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
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

type NavigationItem = {
  name: string;
  href: string;
  icon: any;
  children?: NavigationItem[];
};

const navigation: NavigationItem[] = [
  { name: "Dashboard", href: "/", icon: BarChart3 },
  { name: "Companies", href: "/companies", icon: Building2 },
  { name: "Deals", href: "/deals", icon: DollarSign },
  { name: "People", href: "/people", icon: Users },
  { name: "Events", href: "/events", icon: Calendar },
  { name: "Invoices", href: "/invoices", icon: FileText },
  { name: "Lead Finder", href: "/lead-finder", icon: Sparkles },
  { name: "Pipeline", href: "/pipeline", icon: TrendingUp },
  { 
    name: "Sequences", 
    href: "#sequences", 
    icon: Mail,
    children: [
      { name: "All Sequences", href: "/sequences", icon: Mail },
      { name: "Auto-Responses", href: "/auto-responses", icon: Sparkles },
      { name: "Active Campaigns", href: "/company-sequences", icon: TrendingUp },
    ]
  },
  { 
    name: "Campaigns", 
    href: "#campaigns", 
    icon: Send,
    children: [
      { name: "Overview", href: "/campaigns", icon: Briefcase },
      { name: "All Campaigns", href: "/all-campaigns", icon: Activity },
    ]
  },
  { name: "Conversations", href: "/conversations", icon: MessageSquare },
  { 
    name: "Collaboration", 
    href: "#collaboration", 
    icon: Users,
    children: [
      { name: "Teams", href: "/teams", icon: Users },
      { name: "Shared Inbox", href: "/shared-inbox", icon: Mail },
      { name: "Files", href: "/files", icon: FolderOpen },
    ]
  },
  { 
    name: "Email Settings", 
    href: "#email-settings", 
    icon: Plug2,
    children: [
      { name: "Email Providers", href: "/integrations/email-providers", icon: Send },
    ]
  },
  { 
    name: "Settings", 
    href: "#settings", 
    icon: Settings,
    children: [
      { name: "Automation Rules", href: "/automation-rules", icon: Zap },
      { name: "A/B Testing", href: "/ab-testing", icon: Activity },
    ]
  },
];

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
  const { user, signOut } = useAuth();
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
        className="fixed top-3 left-3 z-50 lg:hidden bg-background/80 backdrop-blur-sm border shadow-sm"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
      >
        {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "flex h-full flex-col border-r bg-card transition-all duration-300",
        "fixed lg:relative inset-y-0 left-0 z-50",
        isCollapsed ? "lg:w-16" : "w-64",
        // Mobile: hidden by default, slide in when open
        isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="flex h-16 items-center border-b px-3 justify-between">
        {!isCollapsed && (
          <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            LeadGenie
          </h1>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="h-8 w-8 hidden md:flex"
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
          // Check if current route is in this group's children
          const isGroupActive = item.children?.some(child => location.pathname === child.href) || false;
          const isActive = location.pathname === item.href;
          
          // Render parent item with children (collapsible group)
          if (item.children) {
            return (
              <Collapsible key={item.name} defaultOpen={isGroupActive}>
                <CollapsibleTrigger asChild>
                  <button
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      isGroupActive
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      isCollapsed && "justify-center"
                    )}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    {!isCollapsed && (
                      <>
                        <span className="flex-1 text-left">{item.name}</span>
                        <ChevronDown className="h-4 w-4 transition-transform duration-200" />
                      </>
                    )}
                  </button>
                </CollapsibleTrigger>
                {!isCollapsed && (
                  <CollapsibleContent className="space-y-1 mt-1 ml-4">
                    {item.children.map((child) => {
                      const isChildActive = location.pathname === child.href;
                      
                      // Get pending count for child items
                      let pendingCount = 0;
                      if (pendingCounts) {
                        if (child.href === '/deals') pendingCount = pendingCounts.deals;
                        else if (child.href === '/sequences') pendingCount = pendingCounts.sequences;
                        else if (child.href === '/company-sequences') pendingCount = pendingCounts.campaigns;
                        else if (child.href === '/events') pendingCount = pendingCounts.events;
                      }
                      
                      return (
                        <Link
                          key={child.name}
                          to={child.href}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors relative",
                            isChildActive
                              ? "bg-primary text-primary-foreground font-medium"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          )}
                        >
                          <child.icon className="h-4 w-4 shrink-0" />
                          <span className="flex-1">{child.name}</span>
                          {pendingCount > 0 && (
                            <Badge 
                              variant="secondary" 
                              className="h-5 min-w-5 px-1 text-xs font-semibold bg-destructive text-destructive-foreground animate-pulse"
                            >
                              {pendingCount > 99 ? '99+' : pendingCount}
                            </Badge>
                          )}
                        </Link>
                      );
                    })}
                  </CollapsibleContent>
                )}
              </Collapsible>
            );
          }
          
          // Render regular navigation item
          const pendingCount = getPendingCount(item.href, pendingCounts, pendingReviewsCount);
          
          const linkContent = (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors relative",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                isCollapsed && "justify-center"
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!isCollapsed && <span className="flex-1">{item.name}</span>}
              {pendingCount > 0 && !isCollapsed && (
                <Badge 
                  variant="secondary" 
                  className="h-5 min-w-5 px-1 text-xs font-semibold bg-destructive text-destructive-foreground animate-pulse"
                >
                  {pendingCount > 99 ? '99+' : pendingCount}
                </Badge>
              )}
              {pendingCount > 0 && isCollapsed && (
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
                  "w-full h-auto p-3",
                  isCollapsed ? "justify-center" : "justify-start gap-3"
                )}
              >
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
                {!isCollapsed && (
                  <div className="flex flex-col items-start text-sm">
                    <span className="font-medium">{getUserDisplayName()}</span>
                    <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                      {user.email}
                    </span>
                  </div>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/profile" className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  Profile Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
      </div>
    </>
  );
};
