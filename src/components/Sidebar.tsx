import { Building2, Users, DollarSign, BarChart3, Mail, Sparkles, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link, useLocation } from "react-router-dom";

const navigation = [
  { name: "Dashboard", href: "/", icon: BarChart3 },
  { name: "Companies", href: "/companies", icon: Building2 },
  { name: "Deals", href: "/deals", icon: DollarSign },
  { name: "People", href: "/people", icon: Users },
  { name: "Lead Finder", href: "/lead-finder", icon: Sparkles },
  { name: "Pipeline", href: "/pipeline", icon: TrendingUp },
  { name: "Sequences", href: "/sequences", icon: Mail },
];

export const Sidebar = () => {
  const location = useLocation();

  return (
    <div className="flex h-full w-64 flex-col border-r bg-card">
      <div className="flex h-16 items-center border-b px-6">
        <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          LeadGeni
        </h1>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
};
