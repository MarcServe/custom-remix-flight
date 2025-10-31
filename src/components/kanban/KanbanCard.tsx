import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Calendar, Building2 } from "lucide-react";
import { format } from "date-fns";

interface KanbanCardProps {
  id: string;
  title: string;
  company?: string;
  amount?: number;
  closeDate?: string;
  status?: string;
  onClick?: () => void;
}

export function KanbanCard({
  id,
  title,
  company,
  amount,
  closeDate,
  status,
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

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card 
        className="cursor-pointer hover:shadow-md transition-shadow bg-card"
        onClick={onClick}
      >
        <CardContent className="p-4 space-y-2">
          <h4 className="font-semibold text-sm line-clamp-2">{title}</h4>
          
          {company && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Building2 className="h-3 w-3" />
              <span className="truncate">{company}</span>
            </div>
          )}
          
          {amount && (
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <DollarSign className="h-4 w-4" />
              ${amount.toLocaleString()}
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
