import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Send, RefreshCw } from "lucide-react";

interface AIResponsePreviewProps {
  subject: string;
  body: string;
  onSubjectChange: (subject: string) => void;
  onBodyChange: (body: string) => void;
  onSend: () => void;
  onRegenerate: () => void;
  isSending?: boolean;
  isRegenerating?: boolean;
}

export default function AIResponsePreview({
  subject,
  body,
  onSubjectChange,
  onBodyChange,
  onSend,
  onRegenerate,
  isSending = false,
  isRegenerating = false,
}: AIResponsePreviewProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>AI-Generated Response</CardTitle>
        <CardDescription>
          Review and edit the AI-generated email before sending
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="ai-subject">Subject</Label>
          <Input
            id="ai-subject"
            value={subject}
            onChange={(e) => onSubjectChange(e.target.value)}
            placeholder="Email subject"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ai-body">Message</Label>
          <Textarea
            id="ai-body"
            value={body}
            onChange={(e) => onBodyChange(e.target.value)}
            className="min-h-[300px]"
            placeholder="Email body"
          />
        </div>

        <div className="flex gap-3">
          <Button onClick={onSend} disabled={isSending || !subject || !body} className="flex-1">
            {isSending ? (
              <>
                <Send className="h-4 w-4 mr-2 animate-pulse" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Response
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={onRegenerate}
            disabled={isRegenerating}
          >
            {isRegenerating ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Regenerating...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Regenerate
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}