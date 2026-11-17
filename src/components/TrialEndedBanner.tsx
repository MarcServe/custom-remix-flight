import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Sparkles } from "lucide-react";

/** Shown on every page once the trial is over and there is no plan: records stay reachable, the rest is locked. */
export function TrialEndedBanner() {
  const { planTier, planResolved } = useAuth();
  const { pathname } = useLocation();
  if (!planResolved || planTier !== "free" || pathname === "/subscription") return null;
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
      <span>
        <b>Your free trial has ended.</b> You can still reach your companies, people and deals. Campaigns, lead finding and everything else need a plan.
      </span>
      <Link to="/subscription" className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
        <Sparkles className="h-3.5 w-3.5" /> See plans
      </Link>
    </div>
  );
}
