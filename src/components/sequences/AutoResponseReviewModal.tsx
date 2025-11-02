import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Sparkles, Send, XCircle, RefreshCw, Building2, Mail } from "lucide-react";
import { format } from "date-fns";
import {
  useApproveReview,
  useRejectReview,
  useRegenerateReview,
  PendingReview,
} from "@/hooks/use-pending-reviews";

interface AutoResponseReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  review: PendingReview | null;
}

export function AutoResponseReviewModal({
  open,
  onOpenChange,
  review,
}: AutoResponseReviewModalProps) {
  const [editMode, setEditMode] = useState(false);
  const [editedSubject, setEditedSubject] = useState("");
  const [editedBody, setEditedBody] = useState("");

  const approveMutation = useApproveReview();
  const rejectMutation = useRejectReview();
  const regenerateMutation = useRegenerateReview();

  const handleEdit = () => {
    if (review) {
      setEditedSubject(review.metadata?.subject || "");
      setEditedBody(review.metadata?.body || "");
      setEditMode(true);
    }
  };

  const handleApprove = async () => {
    if (!review) return;

    await approveMutation.mutateAsync({
      reviewId: review.id,
      subject: editMode ? editedSubject : undefined,
      body: editMode ? editedBody : undefined,
    });

    onOpenChange(false);
    setEditMode(false);
  };

  const handleReject = async () => {
    if (!review) return;

    await rejectMutation.mutateAsync(review.id);
    onOpenChange(false);
  };

  const handleRegenerate = async () => {
    if (!review) return;

    await regenerateMutation.mutateAsync(review.id);
    onOpenChange(false);
  };

  if (!review) return null;

  const isPending = approveMutation.isPending || rejectMutation.isPending || regenerateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Review AI-Generated Response
          </DialogTitle>
          <DialogDescription>
            Review and approve the AI-generated email response before sending
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Company Info */}
          <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50">
            <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-semibold">{review.metadata?.company_name || 'Company'}</p>
              <p className="text-sm text-muted-foreground">
                {review.metadata?.sequence_name || 'Email Sequence'}
              </p>
            </div>
            <div className="text-right">
              <Badge variant="outline" className="mb-1">
                {review.ai_model}
              </Badge>
              <p className="text-xs text-muted-foreground">
                {format(new Date(review.generated_at), 'MMM d, HH:mm')}
              </p>
            </div>
          </div>

          {/* Original Inbound Email */}
          {review.metadata?.inbound_subject && (
            <>
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Replying to:
                </Label>
                <div className="p-3 rounded-lg border bg-muted/30">
                  <p className="text-sm">
                    <span className="font-medium">From:</span> {review.metadata.inbound_from}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Subject:</span> {review.metadata.inbound_subject}
                  </p>
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* AI Response */}
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="review-subject">Subject</Label>
                {!editMode && (
                  <Button variant="ghost" size="sm" onClick={handleEdit}>
                    Edit
                  </Button>
                )}
              </div>
              <Input
                id="review-subject"
                value={editMode ? editedSubject : review.metadata?.subject || ''}
                onChange={(e) => setEditedSubject(e.target.value)}
                disabled={!editMode || isPending}
                className={editMode ? 'border-primary' : ''}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="review-body">Body</Label>
              <Textarea
                id="review-body"
                value={editMode ? editedBody : review.metadata?.body || ''}
                onChange={(e) => setEditedBody(e.target.value)}
                disabled={!editMode || isPending}
                rows={12}
                className={editMode ? 'border-primary' : ''}
              />
            </div>
          </div>

          {/* AI Metadata */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>Response time: {review.response_time_ms}ms</span>
            <span>Tokens: {review.token_count}</span>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="flex gap-2 flex-1">
            <Button
              variant="outline"
              onClick={handleRegenerate}
              disabled={isPending}
              className="flex-1 sm:flex-none"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Regenerate
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={isPending}
              className="flex-1 sm:flex-none"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Reject
            </Button>
          </div>
          <Button
            onClick={handleApprove}
            disabled={isPending}
            className="flex-1 sm:flex-none"
          >
            <Send className="h-4 w-4 mr-2" />
            {editMode ? 'Send Edited' : 'Approve & Send'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
