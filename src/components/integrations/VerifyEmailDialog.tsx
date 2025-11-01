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
import { Mail, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { nangoClient } from "@/lib/integrations/nango";

interface VerifyEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type Step = "email" | "code" | "success";

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

  const handleSendVerification = async () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await nangoClient.sendVerificationEmail(email);

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
                Enter your business email address to receive a verification code.
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
                      handleSendVerification();
                    }
                  }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleSendVerification} disabled={isLoading}>
                {isLoading ? (
                  "Sending..."
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Send Verification
                  </>
                )}
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
