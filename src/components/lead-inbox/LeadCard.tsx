import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { QualityScoreBadge } from "@/components/lead-finder/QualityScoreBadge";
import { 
  Building2, 
  Globe, 
  Mail, 
  Users, 
  CheckCircle2, 
  XCircle,
  MapPin,
  Briefcase,
  ExternalLink,
  Sparkles,
  Info
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LeadCardProps {
  lead: {
    id: string;
    company_name: string;
    company_website: string | null;
    industry: string | null;
    geography: string | null;
    company_size: string | null;
    quality_score: number | null;
    status: string;
    contacts: any[] | null;
    company_data: Record<string, any>;
    created_at: string;
    approval_reason?: string | null;
    approval_confidence?: number | null;
    matched_rules?: string[] | null;
    sources_used?: string[] | null;
  };
  isSelected: boolean;
  onSelect: () => void;
  onView: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  isPending?: boolean;
}

export function LeadCard({ 
  lead, 
  isSelected, 
  onSelect, 
  onView, 
  onApprove, 
  onReject,
  isPending 
}: LeadCardProps) {
  const companyData = lead.company_data || {};
  const contacts = lead.contacts || [];
  const isNew = new Date(lead.created_at).getTime() > Date.now() - 24 * 60 * 60 * 1000;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-500/10 text-green-700 border-green-200 dark:text-green-400';
      case 'auto_approved':
        return 'bg-purple-500/10 text-purple-700 border-purple-200 dark:text-purple-400';
      case 'rejected':
        return 'bg-red-500/10 text-red-700 border-red-200 dark:text-red-400';
      default:
        return 'bg-amber-500/10 text-amber-700 border-amber-200 dark:text-amber-400';
    }
  };

  const getHostname = (url: string) => {
    try {
      return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  return (
    <div 
      className={cn(
        "group relative flex items-start gap-4 p-4 rounded-xl border transition-all duration-200 cursor-pointer",
        "hover:shadow-md hover:border-primary/30 hover:bg-accent/30",
        isSelected && "ring-2 ring-primary/50 bg-primary/5 border-primary/30",
        lead.status === 'pending' && "border-l-4 border-l-amber-500"
      )}
      onClick={onView}
    >
      {/* Selection Checkbox */}
      <div className="pt-1">
        <Checkbox 
          checked={isSelected}
          onCheckedChange={onSelect}
          onClick={(e) => e.stopPropagation()}
          className="transition-transform hover:scale-110"
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0 space-y-2">
        {/* Header Row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 shrink-0">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-base truncate">{lead.company_name}</h3>
                {isNew && (
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-200 text-[10px] px-1.5 py-0 h-4">
                    <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                    New
                  </Badge>
                )}
              </div>
              {lead.company_website && (
                <a 
                  href={lead.company_website.startsWith('http') ? lead.company_website : `https://${lead.company_website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Globe className="h-3 w-3" />
                  {getHostname(lead.company_website)}
                  <ExternalLink className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              )}
            </div>
          </div>

          {/* Quality & Status Badges */}
          <div className="flex items-center gap-2 shrink-0">
            <QualityScoreBadge score={lead.quality_score || 0} />
            <Badge variant="outline" className={cn("capitalize text-xs", getStatusColor(lead.status))}>
              {lead.status === 'auto_approved' ? '⚡ Auto' : lead.status}
            </Badge>
            {/* Approval Reason Tooltip */}
            {lead.status === 'auto_approved' && lead.approval_reason && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-purple-500/10 text-purple-600 text-[10px] cursor-help">
                      <Info className="h-3 w-3" />
                      Why auto?
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <div className="space-y-1">
                      <p className="font-medium text-xs">{lead.approval_reason}</p>
                      {lead.matched_rules && lead.matched_rules.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {lead.matched_rules.map((rule, idx) => (
                            <Badge key={idx} variant="secondary" className="text-[10px]">
                              ✓ {rule}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {lead.approval_confidence && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Confidence: {lead.approval_confidence}%
                        </p>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {/* Source badges */}
            {lead.sources_used && lead.sources_used.length > 0 && (
              <div className="flex gap-1">
                {lead.sources_used.slice(0, 2).map((source, idx) => (
                  <Badge key={idx} variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                    {source === 'apify' ? '📍' : source === 'serpapi' ? '🔍' : '🌐'} {source}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Meta Row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          {lead.industry && (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Briefcase className="h-3.5 w-3.5" />
              <span className="truncate max-w-[150px]">{lead.industry}</span>
            </span>
          )}
          {lead.geography && (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              <span className="truncate max-w-[120px]">{lead.geography}</span>
            </span>
          )}
          {lead.company_size && (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              {lead.company_size} employees
            </span>
          )}
          {companyData.generalEmail && (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Mail className="h-3.5 w-3.5" />
              Has email
            </span>
          )}
          {contacts.length > 0 && (
            <Badge variant="secondary" className="text-xs h-5 px-2">
              {contacts.length} contact{contacts.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>

        {/* Description preview if available */}
        {companyData.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {companyData.description}
          </p>
        )}
      </div>

      {/* Action Buttons */}
      {lead.status === 'pending' && (
        <div className="flex flex-col gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button 
            size="sm" 
            variant="ghost"
            className="h-8 w-8 p-0 hover:bg-green-500/10 hover:text-green-600"
            onClick={(e) => {
              e.stopPropagation();
              onApprove?.();
            }}
            disabled={isPending}
          >
            <CheckCircle2 className="h-5 w-5" />
          </Button>
          <Button 
            size="sm" 
            variant="ghost"
            className="h-8 w-8 p-0 hover:bg-red-500/10 hover:text-red-600"
            onClick={(e) => {
              e.stopPropagation();
              onReject?.();
            }}
            disabled={isPending}
          >
            <XCircle className="h-5 w-5" />
          </Button>
        </div>
      )}
    </div>
  );
}
