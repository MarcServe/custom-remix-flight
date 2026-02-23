import * as React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, "0"));

export interface TimePickerProps {
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  "aria-label"?: string;
}

export function TimePicker({
  value = "",
  onChange,
  className,
  disabled,
  "aria-label": ariaLabel,
}: TimePickerProps) {
  const [hour, minute] = value ? value.split(":") : ["", ""];
  const hourVal = hour && HOURS.includes(hour) ? hour : "";
  const minuteVal = value && minute && MINUTES.includes(minute) ? minute : value ? "00" : "";

  const handleHour = (h: string) => {
    const next = `${h}:${minuteVal || "00"}`;
    onChange?.(next);
  };

  const handleMinute = (m: string) => {
    const next = `${hourVal || "00"}:${m}`;
    onChange?.(next);
  };

  return (
    <div
      className={cn("flex items-center gap-1 rounded-md border border-input bg-background px-2", className)}
      role="group"
      aria-label={ariaLabel}
    >
      <Select value={hourVal || "_"} onValueChange={(v) => handleHour(v === "_" ? "" : v)} disabled={disabled}>
        <SelectTrigger className="h-8 min-w-[3rem] border-0 bg-transparent shadow-none focus:ring-0 focus-visible:ring-0">
          <SelectValue placeholder="HH" />
        </SelectTrigger>
        <SelectContent>
          {HOURS.map((h) => (
            <SelectItem key={h} value={h}>
              {h}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-muted-foreground text-xs">:</span>
      <Select value={minuteVal || "_"} onValueChange={(v) => handleMinute(v === "_" ? "00" : v)} disabled={disabled}>
        <SelectTrigger className="h-8 min-w-[3rem] border-0 bg-transparent shadow-none focus:ring-0 focus-visible:ring-0">
          <SelectValue placeholder="MM" />
        </SelectTrigger>
        <SelectContent>
          {MINUTES.map((m) => (
            <SelectItem key={m} value={m}>
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
