import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Calendar, Building2, Tag as TagIcon, AlertCircle } from "lucide-react";
import { format } from "date-fns";

interface KanbanCardProps {
  id: string;
  title: string;
  company?: string;
  amount?: number;
  closeDate?: string;
  status?: string;
  tags?: string[];
  priority?: string;
  onClick?: () => void;
}

export function KanbanCard({
  id,
  title,
  company,
  amount,
  closeDate,
  status,
  tags,
  priority,
  onClick,
}: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getPriorityColor = (p?: string) => {
    switch (p) {
      case 'high': return 'bg-red-500/10 text-red-600 border-red-500/20';
      case 'medium': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      case 'low': return 'bg-green-500/10 text-green-600 border-green-500/20';
      default: return '';
    }
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card 
        className="cursor-pointer hover:shadow-md transition-shadow bg-card"
        onClick={onClick}
      >
        <CardContent className="p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-semibold text-sm line-clamp-2 flex-1">{title}</h4>
            {priority && priority !== 'medium' && (
              <Badge variant="outline" className={`${getPriorityColor(priority)} shrink-0`}>
                <AlertCircle className="h-3 w-3 mr-1" />
                {priority}
              </Badge>
            )}
          </div>
          
          {company && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Building2 className="h-3 w-3" />
              <span className="truncate">{company}</span>
            </div>
          )}

          {tags && tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.slice(0, 2).map((tag, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  <TagIcon className="h-3 w-3 mr-1" />
                  {tag}
                </Badge>
              ))}
              {tags.length > 2 && (
                <Badge variant="secondary" className="text-xs">
                  +{tags.length - 2}
                </Badge>
              )}
            </div>
          )}
          
          {amount && (
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <DollarSign className="h-4 w-4" />
              £{amount.toLocaleString()}
            </div>
          )}
          
          {closeDate && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {format(new Date(closeDate), "MMM dd")}
            </div>
          )}
          
          {status && (
            <Badge variant="outline" className="text-xs">
              {status}
            </Badge>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
