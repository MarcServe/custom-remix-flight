import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  PlanTier,
  TIER_RANK,
  PLAN_LABELS,
  PLAN_PRICES,
  TIER_FEATURES,
} from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, Sparkles, Check, ArrowRight } from 'lucide-react';

interface PlanGateProps {
  /** Minimum plan tier required to see children */
  requiredTier: 'individual' | 'pro' | 'leadboosters';
  /** Human-readable feature name shown in the upgrade card */
  feature?: string;
  children: ReactNode;
}

const UPGRADE_COLORS: Record<'individual' | 'pro' | 'leadboosters', string> = {
  individual: 'text-sky-600 border-sky-500 bg-sky-500/5',
  pro:        'text-violet-600 border-violet-500 bg-violet-500/5',
  leadboosters: 'text-primary border-primary bg-primary/5',
};

const UPGRADE_ICON_BG: Record<'individual' | 'pro' | 'leadboosters', string> = {
  individual:   'bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400',
  pro:          'bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400',
  leadboosters: 'bg-primary/10 text-primary',
};

const BUTTON_CLASS: Record<'individual' | 'pro' | 'leadboosters', string> = {
  individual:   'bg-sky-600 hover:bg-sky-700 text-white',
  pro:          'bg-violet-600 hover:bg-violet-700 text-white',
  leadboosters: '',  // uses default primary
};

export function PlanGate({ requiredTier, feature, children }: PlanGateProps) {
  const { planTier, isAtLeast } = useAuth();
  const navigate = useNavigate();

  if (isAtLeast(requiredTier)) {
    return <>{children}</>;
  }

  const tierLabel    = PLAN_LABELS[requiredTier];
  const tierPrice    = PLAN_PRICES[requiredTier];
  const tierFeatures = TIER_FEATURES[requiredTier];
  const colorClass   = UPGRADE_COLORS[requiredTier];
  const iconBg       = UPGRADE_ICON_BG[requiredTier];
  const btnClass     = BUTTON_CLASS[requiredTier];

  const isLoggedOutOrFree = planTier === 'free';
  const isDowngradedPlan  = !isLoggedOutOrFree && TIER_RANK[planTier] < TIER_RANK[requiredTier];

  return (
    <div className="container mx-auto px-4 py-12 max-w-xl">
      <Card className={`border-2 ${colorClass}`}>
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-4">
            <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${iconBg}`}>
              <Lock className="h-7 w-7" />
            </div>
          </div>

          <CardTitle className="text-2xl">
            {isDowngradedPlan ? 'Upgrade to unlock this' : 'Subscribe to continue'}
          </CardTitle>

          <CardDescription className="text-sm mt-1">
            {feature
              ? <><span className="font-medium text-foreground">{feature}</span> requires the <span className="font-medium text-foreground">{tierLabel}</span> plan.</>
              : <>This feature requires the <span className="font-medium text-foreground">{tierLabel}</span> plan.</>}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Price pill */}
          <div className="flex items-baseline gap-1 justify-center">
            <span className="text-4xl font-extrabold">{tierPrice.split('/')[0]}</span>
            {tierPrice.includes('/') && (
              <span className="text-muted-foreground text-sm">/{tierPrice.split('/')[1]}</span>
            )}
          </div>

          {/* Feature list */}
          <ul className="space-y-2 text-sm">
            {tierFeatures.map((f) => (
              <li key={f} className="flex items-start gap-2 text-muted-foreground">
                <Check className="h-4 w-4 mt-0.5 shrink-0 text-emerald-500" />
                <span>{f}</span>
              </li>
            ))}
          </ul>

          {/* CTA */}
          <Button
            className={`w-full gap-2 ${btnClass}`}
            size="lg"
            onClick={() => navigate('/subscription')}
          >
            <Sparkles className="h-4 w-4" />
            {isDowngradedPlan
              ? `Upgrade to ${tierLabel}`
              : `Subscribe — ${tierPrice}`}
            <ArrowRight className="h-4 w-4 ml-auto" />
          </Button>

          {isDowngradedPlan && (
            <p className="text-center text-xs text-muted-foreground">
              You're on the <span className="font-medium">{PLAN_LABELS[planTier]}</span> plan.
              Upgrade anytime — billed monthly, cancel whenever.
            </p>
          )}
          {isLoggedOutOrFree && (
            <p className="text-center text-xs text-muted-foreground">
              New accounts start with a 7-day free trial. Cancel anytime.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
