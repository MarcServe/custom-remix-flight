import { useNavigate } from "react-router-dom";
import { ArrowLeft, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import BulkEmailDialog from "@/components/BulkEmailDialog";

/**
 * Dedicated full-page composer for campaigns where each recipient has their own subject/body
 * (file import or AI “personalized for all”). Keeps this path separate from the modal
 * “one template + {{variables}}” bulk send on Campaigns.
 */
export default function PersonalizedEmailCampaign() {
  const navigate = useNavigate();

  return (
    <div className="flex w-full min-w-0 flex-col min-h-[calc(100dvh-5.5rem)] sm:min-h-[calc(100dvh-4rem)] -mx-4 -mt-2 lg:-mx-6 lg:-mt-2 xl:-mx-8">
      <header className="shrink-0 border-b bg-muted/40 px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3">
          <Button type="button" variant="ghost" size="sm" className="gap-2 -ml-2" onClick={() => navigate("/campaigns")}>
            <ArrowLeft className="h-4 w-4" />
            Back to campaigns
          </Button>
          <div className="flex min-w-0 flex-1 items-center gap-2 text-sm text-muted-foreground">
            <FileSpreadsheet className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate">Import or generate a unique message per recipient</span>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col min-h-0 px-4 py-4 sm:px-6 sm:py-6 bg-background/80">
        <div className="mb-4 rounded-lg border border-dashed border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground">
          <p className="font-medium text-primary">Per-recipient campaign</p>
          <p className="mt-1 text-muted-foreground">
            Use <strong>Import file</strong> or <strong>Merge file</strong> below with columns for email, subject, and body — or
            expand <strong>AI Email Generator</strong> and run <strong>Generate Personalized Emails for All</strong>. This page
            is only for that workflow; for one email template to many people, use{" "}
            <button
              type="button"
              className="font-medium text-primary underline-offset-2 hover:underline"
              onClick={() => navigate("/campaigns")}
            >
              Campaigns → New email campaign
            </button>
            .
          </p>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <BulkEmailDialog
            variant="page"
            open
            onOpenChange={(next) => {
              if (!next) navigate("/campaigns");
            }}
            selectedPeople={[]}
          />
        </div>
      </main>
    </div>
  );
}
