import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const emailSchema = z.string().email('Invalid email address');
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');
const nameSchema = z.string().min(2, 'Name must be at least 2 characters');

export default function Auth() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { signIn, signUp, resetPassword, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showReset, setShowReset] = useState(false);

  const mode = searchParams.get('mode') || 'signin';
  const invitationToken = searchParams.get('invitation');

  // Redirect if already logged in
  if (user) {
    navigate('/');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const validateField = (name: string, value: string) => {
    try {
      if (name === 'email') {
        emailSchema.parse(value);
      } else if (name === 'password') {
        passwordSchema.parse(value);
      } else if (name === 'fullName') {
        nameSchema.parse(value);
      }
      setErrors(prev => ({ ...prev, [name]: '' }));
      return true;
    } catch (error: any) {
      const message = error.issues?.[0]?.message || 'Invalid input';
      setErrors(prev => ({ ...prev, [name]: message }));
      return false;
    }
  };

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    const emailValid = validateField('email', email);
    const passwordValid = validateField('password', password);

    if (!emailValid || !passwordValid) return;

    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);

    if (!error) {
      navigate('/');
    }
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const fullName = formData.get('fullName') as string;

    const emailValid = validateField('email', email);
    const passwordValid = validateField('password', password);
    const nameValid = validateField('fullName', fullName);

    if (!emailValid || !passwordValid || !nameValid) return;

    setLoading(true);
    const { error } = await signUp(email, password, fullName);

    if (!error && invitationToken) {
      // If signing up with an invitation, accept it
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data, error: inviteError } = await supabase.rpc('accept_team_invitation', {
          invitation_token: invitationToken
        });

        if (inviteError) {
          console.error('Error accepting invitation:', inviteError);
        } else if (data && typeof data === 'object' && 'success' in data && data.success) {
          // Successfully joined team, navigate to teams page
          setLoading(false);
          navigate('/teams');
          return;
        }
      } catch (err) {
        console.error('Error processing invitation:', err);
      }
    }

    setLoading(false);
    if (!error) {
      navigate('/');
    }
  };

  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;

    const emailValid = validateField('email', email);
    if (!emailValid) return;

    setLoading(true);
    await resetPassword(email);
    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });

    if (error) {
      console.error('Google sign-in error:', error);
      toast.error('Failed to sign in with Google');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center relative overflow-hidden p-4">
      {/* Full-page logo with gradient overlays */}
      <div className="absolute inset-0 pointer-events-none">
        <img 
          src={leadGenieLogo} 
          alt="LeadGenie CRM" 
          className="w-full h-full object-cover object-center opacity-15 animate-fade-in"
          style={{ 
            animationDelay: '0.2s',
            filter: 'blur(0.5px)'
          }}
        />
        {/* Gradient overlays for better contrast */}
        <div className="absolute inset-0 bg-gradient-to-br from-background/80 via-background/60 to-background/80" />
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-background/70" />
      </div>

      {/* Floating elements for additional flair */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      
      <Card className="w-full max-w-md relative z-10 animate-fade-in shadow-[0_15px_45px_-20px_rgba(72,50,250,0.6)] backdrop-blur-md bg-card/98 border-2 border-primary/40 ring-2 ring-primary/20" style={{ animationDelay: '0.3s' }}>
        <CardHeader className="text-center space-y-3 pb-2">
          <div className="flex justify-center animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <img src="/leadgenie-auth-logo.png" alt="LeadGenie CRM" className="h-20 w-auto drop-shadow" />
          </div>

          <div className="space-y-1 animate-fade-in" style={{ animationDelay: '0.4s' }}>
            <CardTitle className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              LeadGenie CRM
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              AI-Powered Lead Generation &amp; Enrichment
            </CardDescription>
          </div>

          <div className="rounded-xl border-2 border-primary/40 bg-card/95/80 px-4 py-4 text-center shadow-[0_10px_30px_-18px_rgba(72,50,250,0.7)] animate-fade-in">
            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
              Modern sales platform powered by AI. Find best-fit accounts, enrich contacts automatically, and close deals faster with guided workflows.
            </p>
            <div className="grid gap-2 text-center">
              <div className="border-2 border-primary/50 rounded-lg px-3 py-3 bg-card/90 shadow-[0_8px_18px_-12px_rgba(72,50,250,0.65)]">
                <p className="text-[11px] font-semibold text-foreground tracking-wide uppercase">
                  AI Lead Finder
                </p>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Discover companies that match your ICP and let AI fill in the missing details instantly.
                </p>
              </div>
              <div className="border-2 border-primary/50 rounded-lg px-3 py-3 bg-card/90 shadow-[0_8px_18px_-12px_rgba(72,50,250,0.65)]">
                <p className="text-[11px] font-semibold text-foreground tracking-wide uppercase">
                  Smart Contact Management
                </p>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Stay on top of every relationship with automated reminders and clean, enriched records.
                </p>
              </div>
              <div className="border-2 border-primary/50 rounded-lg px-3 py-3 bg-card/90 shadow-[0_8px_18px_-12px_rgba(72,50,250,0.65)]">
                <p className="text-[11px] font-semibold text-foreground tracking-wide uppercase">
                  Pipeline Analytics
                </p>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Visualize your funnel, forecast revenue, and focus on the deals that move the needle.
                </p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="animate-fade-in" style={{ animationDelay: '0.6s' }}>
          <Tabs defaultValue={mode} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              {!showReset ? (
                <div className="space-y-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                  >
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Continue with Google
                  </Button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">Or continue with email</span>
                    </div>
                  </div>

                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signin-email">Email</Label>
                      <Input
                        id="signin-email"
                        name="email"
                        type="email"
                        placeholder="you@example.com"
                        required
                        onChange={(e) => validateField('email', e.target.value)}
                      />
                      {errors.email && (
                        <p className="text-sm text-destructive">{errors.email}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signin-password">Password</Label>
                      <Input
                        id="signin-password"
                        name="password"
                        type="password"
                        placeholder="••••••••"
                        required
                        onChange={(e) => validateField('password', e.target.value)}
                      />
                      {errors.password && (
                        <p className="text-sm text-destructive">{errors.password}</p>
                      )}
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setShowReset(true)}
                        className="text-sm text-muted-foreground hover:text-primary transition-colors"
                      >
                        Forgot Password?
                      </button>
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Sign In
                    </Button>
                  </form>
                </div>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reset-email">Email</Label>
                    <Input
                      id="reset-email"
                      name="email"
                      type="email"
                      placeholder="you@example.com"
                      required
                      onChange={(e) => validateField('email', e.target.value)}
                    />
                    {errors.email && (
                      <p className="text-sm text-destructive">{errors.email}</p>
                    )}
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Send Reset Link
                  </Button>
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => setShowReset(false)}
                      className="text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      Back to Sign In
                    </button>
                  </div>
                </form>
              )}
            </TabsContent>

            <TabsContent value="signup">
              {invitationToken && (
                <div className="mb-4 p-3 bg-primary/10 border border-primary/20 rounded-lg">
                  <p className="text-sm text-primary font-medium">
                    🎉 You've been invited to join a team!
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Complete sign up to accept the invitation.
                  </p>
                </div>
              )}

              <div className="space-y-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                >
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Continue with Google
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">Or continue with email</span>
                  </div>
                </div>

                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name</Label>
                    <Input
                      id="signup-name"
                      name="fullName"
                      type="text"
                      placeholder="John Doe"
                      required
                      onChange={(e) => validateField('fullName', e.target.value)}
                    />
                    {errors.fullName && (
                      <p className="text-sm text-destructive">{errors.fullName}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      name="email"
                      type="email"
                      placeholder="you@example.com"
                      required
                      onChange={(e) => validateField('email', e.target.value)}
                    />
                    {errors.email && (
                      <p className="text-sm text-destructive">{errors.email}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      name="password"
                      type="password"
                      placeholder="••••••••"
                      required
                      onChange={(e) => validateField('password', e.target.value)}
                    />
                    {errors.password && (
                      <p className="text-sm text-destructive">{errors.password}</p>
                    )}
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Sign Up
                  </Button>
                </form>
              </div>
            </TabsContent>

          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
