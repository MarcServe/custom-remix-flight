import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Mail, Check, Server } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { nangoClient } from "@/lib/integrations/nango";

interface VerifyEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type Step = "email" | "smtp" | "code" | "success";

export function VerifyEmailDialog({
  open,
  onOpenChange,
  onSuccess,
}: VerifyEmailDialogProps) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [connectionId, setConnectionId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [useDirectSMTP, setUseDirectSMTP] = useState(false);
  
  // SMTP Configuration
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUsername, setSmtpUsername] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpSecure, setSmtpSecure] = useState(true);

  const handleContinue = () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    if (useDirectSMTP) {
      setStep("smtp");
    } else {
      handleSendVerification();
    }
  };

  const handleSendVerification = async (smtpConfig?: any) => {
    setIsLoading(true);
    try {
      const metadata = smtpConfig ? {
        smtp_mode: 'direct',
        smtp_host: smtpConfig.host,
        smtp_port: smtpConfig.port,
        smtp_username: smtpConfig.username,
        smtp_password: smtpConfig.password,
        smtp_secure: smtpConfig.secure,
      } : {
        smtp_mode: 'resend',
      };

      const { data, error } = await nangoClient.sendVerificationEmail(email, metadata);

      if (error) {
        throw error;
      }

      if (data?.connectionId) {
        setConnectionId(data.connectionId);
      }

      toast({
        title: "Verification email sent",
        description: `We've sent a verification code to ${email}`,
      });

      setStep("code");
    } catch (error: any) {
      toast({
        title: "Failed to send verification",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSMTPSubmit = () => {
    if (!smtpHost || !smtpPort || !smtpUsername || !smtpPassword) {
      toast({
        title: "Missing SMTP details",
        description: "Please fill in all SMTP configuration fields",
        variant: "destructive",
      });
      return;
    }

    handleSendVerification({
      host: smtpHost,
      port: parseInt(smtpPort),
      username: smtpUsername,
      password: smtpPassword,
      secure: smtpSecure,
    });
  };

  const handleVerifyCode = async () => {
    if (!code || code.length !== 6) {
      toast({
        title: "Invalid code",
        description: "Please enter the 6-digit verification code",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await nangoClient.verifyEmail(code, connectionId);

      if (error) {
        throw error;
      }

      setStep("success");
      
      toast({
        title: "Email verified!",
        description: `${email} has been successfully verified`,
      });

      setTimeout(() => {
        onSuccess();
        handleClose();
      }, 2000);
    } catch (error: any) {
      toast({
        title: "Verification failed",
        description: error.message || "Please check the code and try again",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setIsLoading(true);
    try {
      await nangoClient.sendVerificationEmail(email);
      toast({
        title: "Code resent",
        description: "A new verification code has been sent to your email",
      });
    } catch (error: any) {
      toast({
        title: "Failed to resend",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setStep("email");
    setEmail("");
    setCode("");
    setConnectionId("");
    setUseDirectSMTP(false);
    setSmtpHost("");
    setSmtpPort("587");
    setSmtpUsername("");
    setSmtpPassword("");
    setSmtpSecure(true);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        {step === "email" && (
          <>
            <DialogHeader>
              <DialogTitle>Verify Business Email</DialogTitle>
              <DialogDescription>
                Enter your business email address to configure SMTP.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isLoading) {
                      handleContinue();
                    }
                  }}
                />
              </div>
              
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4" />
                  <div>
                    <Label htmlFor="direct-smtp" className="cursor-pointer">Use Direct SMTP</Label>
                    <p className="text-xs text-muted-foreground">Configure your own SMTP server</p>
                  </div>
                </div>
                <Switch
                  id="direct-smtp"
                  checked={useDirectSMTP}
                  onCheckedChange={setUseDirectSMTP}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleContinue} disabled={isLoading}>
                Continue
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "smtp" && (
          <>
            <DialogHeader>
              <DialogTitle>Configure SMTP Server</DialogTitle>
              <DialogDescription>
                Enter your SMTP server details for direct email sending.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[400px] overflow-y-auto">
              <div className="grid gap-2">
                <Label htmlFor="smtp-host">SMTP Host</Label>
                <Input
                  id="smtp-host"
                  placeholder="smtp.gmail.com"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="smtp-port">SMTP Port</Label>
                <Input
                  id="smtp-port"
                  type="number"
                  placeholder="587"
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="smtp-username">Username</Label>
                <Input
                  id="smtp-username"
                  placeholder="your-email@gmail.com"
                  value={smtpUsername}
                  onChange={(e) => setSmtpUsername(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="smtp-password">Password / App Password</Label>
                <Input
                  id="smtp-password"
                  type="password"
                  placeholder="••••••••"
                  value={smtpPassword}
                  onChange={(e) => setSmtpPassword(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <Label htmlFor="smtp-secure" className="cursor-pointer">Use TLS/SSL</Label>
                  <p className="text-xs text-muted-foreground">Secure connection (recommended)</p>
                </div>
                <Switch
                  id="smtp-secure"
                  checked={smtpSecure}
                  onCheckedChange={setSmtpSecure}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("email")}>
                Back
              </Button>
              <Button onClick={handleSMTPSubmit} disabled={isLoading}>
                {isLoading ? "Testing..." : "Test & Continue"}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "code" && (
          <>
            <DialogHeader>
              <DialogTitle>Enter Verification Code</DialogTitle>
              <DialogDescription>
                We've sent a 6-digit code to {email}. Check your inbox and spam folder.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="code">Verification Code</Label>
                <Input
                  id="code"
                  type="text"
                  placeholder="000000"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isLoading && code.length === 6) {
                      handleVerifyCode();
                    }
                  }}
                  className="text-center text-2xl tracking-widest"
                />
              </div>
              <Button
                variant="link"
                onClick={handleResend}
                disabled={isLoading}
                className="text-sm"
              >
                Didn't receive the code? Resend
              </Button>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("email")}>
                Back
              </Button>
              <Button
                onClick={handleVerifyCode}
                disabled={isLoading || code.length !== 6}
              >
                {isLoading ? "Verifying..." : "Verify Email"}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "success" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-600" />
                Email Verified!
              </DialogTitle>
              <DialogDescription>
                Your email {email} has been successfully verified and is ready to use.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-center py-8">
              <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center">
                <Check className="h-10 w-10 text-green-600" />
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
