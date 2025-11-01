import { useState, useEffect } from "react";
import { Building2, Users, DollarSign, BarChart3, Mail, Sparkles, TrendingUp, LogOut, User, Activity, Briefcase, ChevronLeft, ChevronRight, Calendar, Plug2, Menu, X, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link, useLocation } from "react-router-dom";
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
import { usePendingCounts } from "@/hooks/use-pending-counts";
import { useEventsRealtime, useDealsRealtimeForNotifications, useCampaignsRealtimeForNotifications } from "@/hooks/use-realtime";

const navigation = [
  { name: "Dashboard", href: "/", icon: BarChart3 },
  { name: "Companies", href: "/companies", icon: Building2 },
  { name: "Deals", href: "/deals", icon: DollarSign },
  { name: "People", href: "/people", icon: Users },
  { name: "Events", href: "/events", icon: Calendar },
  { name: "Lead Finder", href: "/lead-finder", icon: Sparkles },
  { name: "Pipeline", href: "/pipeline", icon: TrendingUp },
  { name: "Sequences", href: "/sequences", icon: Mail },
  { name: "All Campaigns", href: "/all-campaigns", icon: Activity },
  { name: "Active Campaigns", href: "/company-sequences", icon: TrendingUp },
  { name: "Bulk Campaigns", href: "/campaigns", icon: Briefcase },
  { name: "Conversations", href: "/conversations", icon: MessageSquare },
  { name: "Integrations", href: "/integrations", icon: Plug2 },
];

export const Sidebar = () => {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { data: pendingCounts } = usePendingCounts();
  
  // Enable real-time updates for notifications
  useEventsRealtime();
  useDealsRealtimeForNotifications();
  useCampaignsRealtimeForNotifications();

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
            LeadGeni
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
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href;
          
          // Get pending count for this menu item
          let pendingCount = 0;
          if (pendingCounts) {
            if (item.href === '/deals') pendingCount = pendingCounts.deals;
            else if (item.href === '/sequences') pendingCount = pendingCounts.sequences;
            else if (item.href === '/company-sequences') pendingCount = pendingCounts.campaigns;
            else if (item.href === '/events') pendingCount = pendingCounts.events;
          }
          
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
