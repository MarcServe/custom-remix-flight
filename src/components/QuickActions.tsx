import { Link } from "react-router-dom";
import { Search, Building2, Briefcase, Mail } from "lucide-react";
import { Card } from "@/components/ui/card";

const actions = [
  {
    title: "Find Leads",
    description: "AI-powered lead discovery",
    icon: Search,
    href: "/lead-finder",
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
  },
  {
    title: "Companies",
    description: "Manage your companies",
    icon: Building2,
    href: "/companies",
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-50 dark:bg-purple-950/30",
  },
  {
    title: "Deals",
    description: "Track your pipeline",
    icon: Briefcase,
    href: "/deals",
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-50 dark:bg-green-950/30",
  },
  {
    title: "Sequences",
    description: "Email automation",
    icon: Mail,
    href: "/sequences",
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-50 dark:bg-orange-950/30",
  },
];

export const QuickActions = () => {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {actions.map((action) => (
        <Link key={action.title} to={action.href}>
          <Card className="p-6 hover:shadow-lg transition-all cursor-pointer group">
            <div className="flex items-start gap-4">
              <div className={`rounded-lg p-3 ${action.bgColor} group-hover:scale-110 transition-transform`}>
                <action.icon className={`h-6 w-6 ${action.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                  {action.title}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {action.description}
                </p>
              </div>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
};
