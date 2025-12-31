import { Badge } from "@/components/ui/badge";
import { Search, Sparkles, Users, Mail, MapPin, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

interface SourceBadgesProps {
  source?: 'exa' | 'serpapi' | 'google_maps' | 'apify';
  wasEnriched?: boolean;
  hasVerifiedContacts?: boolean;
  hasPatternContacts?: boolean;
  className?: string;
}

export function SourceBadges({ 
  source = 'exa',
  wasEnriched, 
  hasVerifiedContacts, 
  hasPatternContacts,
  className 
}: SourceBadgesProps) {
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {/* Source badge - shows which provider found this lead */}
      {source === 'exa' && (
        <Badge variant="outline" className="h-5 text-xs bg-blue-500/10 text-blue-600 border-blue-500/20">
          <Search className="h-2.5 w-2.5 mr-1" />
          Exa
        </Badge>
      )}
      
      {source === 'serpapi' && (
        <Badge variant="outline" className="h-5 text-xs bg-amber-500/10 text-amber-600 border-amber-500/20">
          <Globe className="h-2.5 w-2.5 mr-1" />
          SerpAPI
        </Badge>
      )}
      
      {source === 'google_maps' && (
        <Badge variant="outline" className="h-5 text-xs bg-red-500/10 text-red-600 border-red-500/20">
          <MapPin className="h-2.5 w-2.5 mr-1" />
          Google Maps
        </Badge>
      )}

      {source === 'apify' && (
        <Badge variant="outline" className="h-5 text-xs bg-teal-500/10 text-teal-600 border-teal-500/20">
          <Search className="h-2.5 w-2.5 mr-1" />
          Apify
        </Badge>
      )}

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

// Component for showing source summary counts in the results header
interface SourcesSummaryProps {
  leads: any[];
  className?: string;
}

export function SourcesSummary({ leads, className }: SourcesSummaryProps) {
  const counts = leads.reduce(
    (acc, lead) => {
      const src = lead.source || 'exa';
      acc[src] = (acc[src] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const hasMultipleSources = Object.keys(counts).length > 1;
  
  if (!hasMultipleSources && counts.exa) {
    return null; // Don't show if only Exa (default)
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5 text-xs", className)}>
      <span className="text-muted-foreground">Sources:</span>
      {counts.exa && counts.exa > 0 && (
        <Badge variant="outline" className="h-5 text-xs bg-blue-500/10 text-blue-600 border-blue-500/20">
          <Search className="h-2.5 w-2.5 mr-1" />
          Exa: {counts.exa}
        </Badge>
      )}
      {counts.serpapi && counts.serpapi > 0 && (
        <Badge variant="outline" className="h-5 text-xs bg-amber-500/10 text-amber-600 border-amber-500/20">
          <Globe className="h-2.5 w-2.5 mr-1" />
          SerpAPI: {counts.serpapi}
        </Badge>
      )}
      {counts.google_maps && counts.google_maps > 0 && (
        <Badge variant="outline" className="h-5 text-xs bg-red-500/10 text-red-600 border-red-500/20">
          <MapPin className="h-2.5 w-2.5 mr-1" />
          Maps: {counts.google_maps}
        </Badge>
      )}
      {counts.apify && counts.apify > 0 && (
        <Badge variant="outline" className="h-5 text-xs bg-teal-500/10 text-teal-600 border-teal-500/20">
          <Search className="h-2.5 w-2.5 mr-1" />
          Apify: {counts.apify}
        </Badge>
      )}
    </div>
  );
}
