import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Sparkles, Check } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";

const LEADGENIE_PRODUCT_ID = "prod_TUNeoAZWiDngEH";

export default function Subscription() {
  const { subscribed, productId, subscriptionEnd, checkSubscription } = useAuth();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleSubscribe = async () => {
    try {
      setLoading(true);
      console.log('[SUBSCRIPTION] Creating checkout session...');
      
      const { data, error } = await supabase.functions.invoke('create-checkout');
      
      if (error) {
        console.error('[SUBSCRIPTION] Error creating checkout:', error);
        throw error;
      }
      
      if (data?.url) {
        console.log('[SUBSCRIPTION] Redirecting to checkout:', data.url);
        window.open(data.url, '_blank');
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error) {
      console.error('[SUBSCRIPTION] Error:', error);
      toast.error('Failed to start checkout process');
    } finally {
      setLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    try {
      setLoading(true);
      console.log('[SUBSCRIPTION] Opening customer portal...');
      
      const { data, error } = await supabase.functions.invoke('customer-portal');
      
      if (error) {
        console.error('[SUBSCRIPTION] Error opening portal:', error);
        throw error;
      }
      
      if (data?.url) {
        console.log('[SUBSCRIPTION] Redirecting to portal:', data.url);
        window.open(data.url, '_blank');
      } else {
        throw new Error('No portal URL returned');
      }
    } catch (error) {
      console.error('[SUBSCRIPTION] Error:', error);
      toast.error('Failed to open subscription management');
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshStatus = async () => {
    try {
      setRefreshing(true);
      console.log('[SUBSCRIPTION] Refreshing subscription status...');
      await checkSubscription();
      toast.success('Subscription status updated');
    } catch (error) {
      console.error('[SUBSCRIPTION] Error refreshing:', error);
      toast.error('Failed to refresh subscription status');
    } finally {
      setRefreshing(false);
    }
  };

  const isLeadGenieActive = subscribed && productId === LEADGENIE_PRODUCT_ID;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Subscription</h1>
        <p className="text-muted-foreground">Manage your LeadGenie subscription</p>
      </div>

      <div className="mb-6 flex gap-3">
        <Button
          onClick={handleRefreshStatus}
          variant="outline"
          disabled={refreshing}
        >
          {refreshing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Refreshing...
            </>
          ) : (
            'Refresh Status'
          )}
        </Button>
      </div>

      {subscribed && (
        <Card className="mb-6 border-primary">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <CardTitle>Active Subscription</CardTitle>
              </div>
              <span className="text-sm bg-primary/10 text-primary px-3 py-1 rounded-full">
                Your Plan
              </span>
            </div>
            <CardDescription>
              You have access to premium features
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Plan</span>
                <span className="font-medium">LeadGenie Premium</span>
              </div>
              {subscriptionEnd && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Renews on</span>
                  <span className="font-medium">
                    {format(new Date(subscriptionEnd), 'MMM dd, yyyy')}
                  </span>
                </div>
              )}
              <Button
                onClick={handleManageSubscription}
                variant="outline"
                className="w-full mt-4"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Manage Subscription'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className={isLeadGenieActive ? 'border-primary' : ''}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            <CardTitle>LeadGenie Premium</CardTitle>
          </div>
          <CardDescription>
            Unlock powerful lead generation features
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-3xl font-bold">
              $9.99<span className="text-lg font-normal text-muted-foreground">/month</span>
            </div>
            
            <ul className="space-y-2">
              {[
                'Advanced lead search',
                'Company enrichment',
                'Contact discovery',
                'Export capabilities',
                'Priority support',
              ].map((feature) => (
                <li key={feature} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <span className="text-sm">{feature}</span>
                </li>
              ))}
            </ul>

            {!isLeadGenieActive && (
              <Button
                onClick={handleSubscribe}
                className="w-full"
                size="lg"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Subscribe Now
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
