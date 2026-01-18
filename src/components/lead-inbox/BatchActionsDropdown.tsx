import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { 
  MoreHorizontal, 
  CheckCircle2, 
  XCircle, 
  Mail, 
  Zap, 
  Trash2,
  Loader2,
  ListPlus
} from "lucide-react";

interface BatchActionsDropdownProps {
  pendingCount: number;
  approvedCount: number;
  totalCount: number;
  batchLeadIds: string[];
  approvedLeadIds: string[];
  pendingLeadIds: string[];
  sequences: Array<{ id: string; name: string }>;
  onApproveAll: (leadIds: string[]) => void;
  onRejectAll: (leadIds: string[]) => void;
  onDeleteAll: (leadIds: string[]) => void;
  onEnrollInSequence: (leadIds: string[], sequenceId: string) => void;
  onCreateCampaign: (leadIds: string[]) => void;
  isLoading?: boolean;
}

export function BatchActionsDropdown({
  pendingCount,
  approvedCount,
  totalCount,
  batchLeadIds,
  approvedLeadIds,
  pendingLeadIds,
  sequences,
  onApproveAll,
  onRejectAll,
  onDeleteAll,
  onEnrollInSequence,
  onCreateCampaign,
  isLoading,
}: BatchActionsDropdownProps) {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 w-8 p-0 hover:bg-accent"
          onClick={(e) => e.stopPropagation()}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MoreHorizontal className="h-4 w-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56" onClick={(e) => e.stopPropagation()}>
        {/* Approve/Reject Actions */}
        {pendingCount > 0 && (
          <>
            <DropdownMenuItem 
              onClick={() => {
                onApproveAll(pendingLeadIds);
                setOpen(false);
              }}
              className="text-green-600 cursor-pointer"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Approve All Pending ({pendingCount})
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => {
                onRejectAll(pendingLeadIds);
                setOpen(false);
              }}
              className="text-red-600 cursor-pointer"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Reject All Pending ({pendingCount})
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        {/* Campaign Actions - for approved leads */}
        {approvedCount > 0 && (
          <>
            <DropdownMenuItem 
              onClick={() => {
                onCreateCampaign(approvedLeadIds);
                setOpen(false);
              }}
              className="cursor-pointer"
            >
              <Mail className="h-4 w-4 mr-2" />
              Create Campaign ({approvedCount})
            </DropdownMenuItem>

            {/* Enroll in Sequence submenu */}
            {sequences.length > 0 && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="cursor-pointer">
                  <Zap className="h-4 w-4 mr-2" />
                  Enroll in Sequence
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="max-h-64 overflow-y-auto">
                  {sequences.map((seq) => (
                    <DropdownMenuItem
                      key={seq.id}
                      onClick={() => {
                        onEnrollInSequence(approvedLeadIds, seq.id);
                        setOpen(false);
                      }}
                      className="cursor-pointer"
                    >
                      <ListPlus className="h-4 w-4 mr-2" />
                      {seq.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}
            <DropdownMenuSeparator />
          </>
        )}

        {/* Delete All */}
        <DropdownMenuItem 
          onClick={() => {
            onDeleteAll(batchLeadIds);
            setOpen(false);
          }}
          className="text-destructive cursor-pointer"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete All ({totalCount})
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
