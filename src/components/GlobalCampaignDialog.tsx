/**
 * GlobalCampaignDialog — renders BulkEmailDialog at the app level so it
 * survives page navigation. Pages open it via useCampaignDialog().
 */
import BulkEmailDialog from "./BulkEmailDialog";
import { useCampaignDialog } from "@/contexts/CampaignDialogContext";

export function GlobalCampaignDialog() {
  const { open, setOpen, selectedPeople, draftId } = useCampaignDialog();

  return (
    <BulkEmailDialog
      open={open}
      onOpenChange={setOpen}
      selectedPeople={selectedPeople as any}
      initialDraftId={draftId}
    />
  );
}
