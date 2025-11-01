import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface QualityStarsProps {
  score: number;
  className?: string;
}

export function QualityStars({ score, className }: QualityStarsProps) {
  const stars = Math.round(score / 20); // Convert 0-100 to 0-5 stars

  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "h-3 w-3",
            i < stars ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
          )}
        />
      ))}
      <span className="text-xs text-muted-foreground ml-1 font-mono">
        {stars}/5
      </span>
    </div>
  );
}
