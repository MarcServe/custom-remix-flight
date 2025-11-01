import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Server, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface SMTPModeToggleProps {
  mode: 'direct' | 'resend';
  onModeChange: (mode: 'direct' | 'resend') => void;
  isLoading?: boolean;
}

export function SMTPModeToggle({ mode, onModeChange, isLoading }: SMTPModeToggleProps) {
  const isDirect = mode === 'direct';

  return (
    <Card className="bg-muted/50">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isDirect ? (
              <Server className="h-5 w-5 text-primary" />
            ) : (
              <Zap className="h-5 w-5 text-primary" />
            )}
            <div>
              <Label htmlFor="smtp-mode" className="cursor-pointer text-base">
                {isDirect ? "Direct SMTP" : "Resend Relay"}
              </Label>
              <p className="text-sm text-muted-foreground">
                {isDirect 
                  ? "Send emails directly from your SMTP server" 
                  : "Send via Resend for better deliverability"}
              </p>
            </div>
          </div>
          <Switch
            id="smtp-mode"
            checked={isDirect}
            onCheckedChange={(checked) => onModeChange(checked ? 'direct' : 'resend')}
            disabled={isLoading}
          />
        </div>
      </CardContent>
    </Card>
  );
}
