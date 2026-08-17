import { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Lock, Sparkles, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface TrialGateProps {
  children: ReactNode;
  feature?: string;
}

export function TrialGate({ children, feature = 'this feature' }: TrialGateProps) {
  const { hasAccess, isInTrial, trialEndsAt, subscribed, subscriptionLoading } = useAuth();
  const navigate = useNavigate();

  // Don't flash the "Trial Expired" card before the subscription/trial status is known.
  if (subscriptionLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (hasAccess) {
    return <>{children}</>;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Card className="border-primary">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Lock className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl">Trial Expired</CardTitle>
          <CardDescription>
            Your 7-day free trial has ended
            {trialEndsAt && ` on ${format(new Date(trialEndsAt), 'MMM dd, yyyy')}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-muted-foreground">
            Subscribe to LeadBoosters Premium to continue using {feature} and unlock all premium features.
          </p>
          
          <div className="bg-muted p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <span className="font-semibold">LeadBoosters Premium</span>
            </div>
            <ul className="space-y-1 text-sm text-muted-foreground ml-7">
              <li>• Advanced lead search</li>
              <li>• Company enrichment</li>
              <li>• Contact discovery</li>
              <li>• Export capabilities</li>
              <li>• Priority support</li>
            </ul>
          </div>

          <Button 
            onClick={() => navigate('/subscription')}
            className="w-full"
            size="lg"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Subscribe Now - £29/month
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
