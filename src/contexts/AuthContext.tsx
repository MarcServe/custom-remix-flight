import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
  checkSubscription: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: any }>;
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

  const signUp = async (email: string, password: string, fullName?: string) => {
    try {
      const redirectUrl = `${window.location.origin}/`;

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
    checkSubscription,
    signIn,
    signUp,
    signOut,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
