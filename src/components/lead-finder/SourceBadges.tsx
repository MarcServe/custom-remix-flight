import { Badge } from "@/components/ui/badge";
import { Search, Sparkles, Users, Mail } from "lucide-react";
import { cn } from "@/lib/utils";

interface SourceBadgesProps {
  wasEnriched?: boolean;
  hasVerifiedContacts?: boolean;
  hasPatternContacts?: boolean;
  className?: string;
}

export function SourceBadges({ 
  wasEnriched, 
  hasVerifiedContacts, 
  hasPatternContacts,
  className 
}: SourceBadgesProps) {
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {/* Exa - Always present (base search) */}
      <Badge variant="outline" className="h-5 text-xs bg-blue-500/10 text-blue-600 border-blue-500/20">
        <Search className="h-2.5 w-2.5 mr-1" />
        Exa
      </Badge>

      {/* Perplexity - If enriched */}
      {wasEnriched && (
        <Badge variant="outline" className="h-5 text-xs bg-purple-500/10 text-purple-600 border-purple-500/20">
          <Sparkles className="h-2.5 w-2.5 mr-1" />
          Perplexity
        </Badge>
      )}

      {/* GetProspect - If verified contacts */}
      {hasVerifiedContacts && (
        <Badge variant="outline" className="h-5 text-xs bg-green-500/10 text-green-600 border-green-500/20">
          <Users className="h-2.5 w-2.5 mr-1" />
          GetProspect
        </Badge>
      )}

      {/* Pattern-guess - If non-verified contacts */}
      {hasPatternContacts && (
        <Badge variant="outline" className="h-5 text-xs bg-slate-500/10 text-slate-600 border-slate-500/20">
          <Mail className="h-2.5 w-2.5 mr-1" />
          Pattern
        </Badge>
      )}
    </div>
  );
}
