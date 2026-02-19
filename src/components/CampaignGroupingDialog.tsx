import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Building2, Mail, Layers, Tag } from "lucide-react";
import { useMemo } from "react";

export interface CompanyForGrouping {
  id: string;
  name: string;
  industry?: string | null;
  tags?: string[] | null;
  description?: string | null;
}

interface CampaignGroupingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companies: CompanyForGrouping[];
  onContinueToCompose: () => void;
}

export function CampaignGroupingDialog({
  open,
  onOpenChange,
  companies,
  onContinueToCompose,
}: CampaignGroupingDialogProps) {
  const byIndustry = useMemo(() => {
    const map = new Map<string, CompanyForGrouping[]>();
    for (const c of companies) {
      const key = (c.industry && c.industry.trim()) || "Other / Unspecified";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [companies]);

  const byFirstTag = useMemo(() => {
    const map = new Map<string, CompanyForGrouping[]>();
    for (const c of companies) {
      const tags = c.tags && Array.isArray(c.tags) ? c.tags.filter(Boolean) : [];
      const key = tags.length > 0 ? String(tags[0]).trim() : "No tags";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [companies]);

  if (companies.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Group companies for campaign
          </DialogTitle>
          <DialogDescription>
            View your selection by industry or by service type (tags). Then continue to compose one email or use this to plan different messages per group.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6 min-h-[200px] max-h-[50vh]">
          <div className="space-y-6 pr-4">
            {/* By industry */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2 mb-2">
                <Building2 className="h-4 w-4" />
                By industry
              </h3>
              <div className="space-y-2">
                {byIndustry.map(([industry, list]) => (
                  <div
                    key={industry}
                    className="rounded-lg border bg-card p-3"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{industry}</span>
                      <Badge variant="secondary">{list.length}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {list.map((c) => c.name).join(", ")}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* By first tag (service type) */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2 mb-2">
                <Tag className="h-4 w-4" />
                By service type (first tag)
              </h3>
              <div className="space-y-2">
                {byFirstTag.map(([tag, list]) => (
                  <div
                    key={tag}
                    className="rounded-lg border bg-card p-3"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{tag}</span>
                      <Badge variant="secondary">{list.length}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {list.map((c) => c.name).join(", ")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => { onOpenChange(false); onContinueToCompose(); }}>
            <Mail className="h-4 w-4 mr-2" />
            Continue to compose
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
