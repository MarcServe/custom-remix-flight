import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  userRole: 'admin' | 'sales_rep' | 'viewer' | null;
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
  const initialLoadRef = useRef(true);

  // Fetch user role when user changes
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
    } else {
      setUserRole(null);
    }
  }, [user]);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

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

  const value = {
    user,
    session,
    loading,
    userRole,
    signIn,
    signUp,
    signOut,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
