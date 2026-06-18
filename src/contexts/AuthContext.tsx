import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ─── Plan tier constants ─────────────────────────────────────────────────────
export const INDIVIDUAL_PRODUCT_ID = 'prod_TUNeoAZWiDngEH'; // £9.99/month
export const PRO_PRODUCT_ID        = 'prod_UbJKukbTXsTZ8Z'; // £19.99/month
// LeadBoosters CRM (£29/month) = any other active subscription

export type PlanTier = 'free' | 'trial' | 'individual' | 'pro' | 'leadboosters';

export const TIER_RANK: Record<PlanTier, number> = {
  free: 0,
  trial: 3,          // trial = full access so users can see all features
  individual: 1,
  pro: 2,
  leadboosters: 3,
};

export const PLAN_LABELS: Record<PlanTier, string> = {
  free: 'Free',
  trial: 'Free Trial',
  individual: 'Individual',
  pro: 'Pro',
  leadboosters: 'LeadBoosters CRM',
};

export const PLAN_PRICES: Record<PlanTier, string> = {
  free: '£0',
  trial: '£0',
  individual: '£9.99/mo',
  pro: '£19.99/mo',
  leadboosters: '£29/mo',
};

// Features unlocked at each tier (cumulative)
export const TIER_FEATURES: Record<'individual' | 'pro' | 'leadboosters', string[]> = {
  individual: [
    'People, Companies & Deals CRM',
    'Bulk email campaigns',
    'Newsletters & broadcast sending',
    'Notes, invoices & activity logs',
    'Team conversations',
  ],
  pro: [
    'Everything in Individual',
    'Email Sequences & Company Sequences',
    'Lead Finder & Lead Inbox',
    'Newsletter Series (automated drip)',
    'Per-recipient personalised email import',
    'Unified campaign analytics',
  ],
  leadboosters: [
    'Everything in Pro',
    'AI Company Enrichment',
    'Autopilot (autonomous lead discovery)',
    'Auto-Response Hub (AI-powered replies)',
    'AI email writer & lead scoring',
    'Full AI feature suite',
  ],
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  userRole: 'admin' | 'sales_rep' | 'viewer' | null;
  subscribed: boolean;
  productId: string | null;
  subscriptionEnd: string | null;
  trialEndsAt: string | null;
  hasAccess: boolean;
  isInTrial: boolean;
  planTier: PlanTier;
  isAtLeast: (tier: PlanTier) => boolean;
  checkSubscription: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName?: string, redirectPath?: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<'admin' | 'sales_rep' | 'viewer' | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [productId, setProductId] = useState<string | null>(null);
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const initialLoadRef = useRef(true);

  // Calculate if user is in trial period
  const isInTrial = trialEndsAt ? new Date(trialEndsAt) > new Date() : false;
  const hasAccess = subscribed || isInTrial;

  // Derive plan tier from subscription state
  const planTier: PlanTier = (() => {
    if (subscribed) {
      if (productId === INDIVIDUAL_PRODUCT_ID) return 'individual';
      if (productId === PRO_PRODUCT_ID) return 'pro';
      return 'leadboosters'; // any other active subscription = full plan
    }
    if (isInTrial) return 'trial';
    return 'free';
  })();

  const isAtLeast = (tier: PlanTier) => TIER_RANK[planTier] >= TIER_RANK[tier];

  // Fetch user role and trial info when user changes
  useEffect(() => {
    if (user) {
      supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          setUserRole(data?.role || 'sales_rep');
        });

      // Calculate trial end date (7 days from user creation)
      supabase
        .from('profiles')
        .select('created_at')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data?.created_at) {
            const trialEnd = new Date(data.created_at);
            trialEnd.setDate(trialEnd.getDate() + 7);
            setTrialEndsAt(trialEnd.toISOString());
          }
        });
    } else {
      setUserRole(null);
      setTrialEndsAt(null);
    }
  }, [user]);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Check subscription when user signs in
        if (session?.user) {
          checkSubscription();
        } else {
          setSubscribed(false);
          setProductId(null);
          setSubscriptionEnd(null);
        }

        // Only show toasts after initial load is complete to avoid showing on page refresh
        if (!initialLoadRef.current) {
          if (event === 'SIGNED_IN') {
            toast.success("Welcome back!", {
              description: "You've successfully signed in.",
            });
          } else if (event === 'SIGNED_OUT') {
            setUserRole(null);
            toast.info("Signed out", {
              description: "You've been signed out successfully.",
            });
          }
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      // Check subscription for existing session
      if (session?.user) {
        checkSubscription();
      }

      // Mark initial load as complete after session check
      initialLoadRef.current = false;
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast.error("Sign in failed", {
          description: error.message,
        });
        return { error };
      }

      return { error: null };
    } catch (error: any) {
      toast.error("Sign in failed", {
        description: error.message,
      });
      return { error };
    }
  };

  const signUp = async (email: string, password: string, fullName?: string, redirectPath = '/') => {
    try {
      const safeRedirectPath = redirectPath.startsWith('/') && !redirectPath.startsWith('//') ? redirectPath : '/';
      const redirectUrl = `${window.location.origin}${safeRedirectPath}`;

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName || 'User',
          },
        },
      });

      if (error) {
        toast.error("Sign up failed", {
          description: error.message,
        });
        return { error };
      }

      toast.success("Account created!", {
        description: "Please check your email to verify your account. The verification link will be sent shortly.",
        duration: 6000,
      });

      return { error: null };
    } catch (error: any) {
      toast.error("Sign up failed", {
        description: error.message,
      });
      return { error };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error: any) {
      toast.error("Sign out failed", {
        description: error.message,
      });
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const redirectUrl = `${window.location.origin}/auth?mode=reset`;

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (error) {
        toast.error("Password reset failed", {
          description: error.message,
        });
        return { error };
      }

      toast.success("Check your email", {
        description: "We've sent you a password reset link.",
      });

      return { error: null };
    } catch (error: any) {
      toast.error("Password reset failed", {
        description: error.message,
      });
      return { error };
    }
  };

  const checkSubscription = async () => {
    try {
      console.log('[AUTH] Checking subscription status...');
      const { data, error } = await supabase.functions.invoke('check-subscription');
      
      if (error) {
        console.error('[AUTH] Error checking subscription:', error);
        return;
      }

      console.log('[AUTH] Subscription check result:', data);
      setSubscribed(data?.subscribed || false);
      setProductId(data?.product_id || null);
      setSubscriptionEnd(data?.subscription_end || null);
    } catch (error) {
      console.error('[AUTH] Error in checkSubscription:', error);
    }
  };

  const value = {
    user,
    session,
    loading,
    userRole,
    subscribed,
    productId,
    subscriptionEnd,
    trialEndsAt,
    hasAccess,
    isInTrial,
    planTier,
    isAtLeast,
    checkSubscription,
    signIn,
    signUp,
    signOut,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
