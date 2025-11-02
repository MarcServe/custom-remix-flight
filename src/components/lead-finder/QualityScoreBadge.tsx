import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
interface QualityScoreBadgeProps {
  score: number;
  className?: string;
}
export function QualityScoreBadge({
  score,
  className
}: QualityScoreBadgeProps) {
  const getGrade = (score: number): {
    grade: string;
    color: string;
  } => {
    if (score >= 80) return {
      grade: "A",
      color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
    };
    if (score >= 60) return {
      grade: "B",
      color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
    };
    if (score >= 40) return {
      grade: "C",
      color: "bg-orange-500/10 text-orange-600 border-orange-500/20"
    };
    return {
      grade: "D",
      color: "bg-red-500/10 text-red-600 border-red-500/20"
    };
  };
  const {
    grade,
    color
  } = getGrade(score);
  return;
}