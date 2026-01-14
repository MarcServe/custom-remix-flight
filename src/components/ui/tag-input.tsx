import * as React from "react";
import { X, Plus, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

// Tag color palette
const TAG_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  blue: { bg: "bg-blue-500/10", text: "text-blue-600", border: "border-blue-200" },
  green: { bg: "bg-green-500/10", text: "text-green-600", border: "border-green-200" },
  purple: { bg: "bg-purple-500/10", text: "text-purple-600", border: "border-purple-200" },
  orange: { bg: "bg-orange-500/10", text: "text-orange-600", border: "border-orange-200" },
  red: { bg: "bg-red-500/10", text: "text-red-600", border: "border-red-200" },
  yellow: { bg: "bg-yellow-500/10", text: "text-yellow-700", border: "border-yellow-200" },
  pink: { bg: "bg-pink-500/10", text: "text-pink-600", border: "border-pink-200" },
  cyan: { bg: "bg-cyan-500/10", text: "text-cyan-600", border: "border-cyan-200" },
};

// Deterministic color based on tag name
function getTagColor(tag: string) {
  const colors = Object.keys(TAG_COLORS);
  const index = tag.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
  return TAG_COLORS[colors[index]];
}

export interface TagInputProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  disabled?: boolean;
  maxTags?: number;
  className?: string;
}

export function TagInput({
  tags,
  onTagsChange,
  suggestions = [],
  placeholder = "Add tag...",
  disabled = false,
  maxTags = 10,
  className,
}: TagInputProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");

  const filteredSuggestions = suggestions.filter(
    (s) =>
      !tags.includes(s) &&
      s.toLowerCase().includes(inputValue.toLowerCase())
  );

  const addTag = (tag: string) => {
    const trimmedTag = tag.trim();
    if (trimmedTag && !tags.includes(trimmedTag) && tags.length < maxTags) {
      onTagsChange([...tags, trimmedTag]);
      setInputValue("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    onTagsChange(tags.filter((t) => t !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputValue.trim()) {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      {/* Tags display */}
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => {
          const colors = getTagColor(tag);
          return (
            <Badge
              key={tag}
              variant="outline"
              className={cn(
                "gap-1 pr-1 font-normal",
                colors.bg,
                colors.text,
                colors.border
              )}
            >
              {tag}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className={cn(
                    "ml-0.5 rounded-full p-0.5 hover:bg-foreground/10",
                    colors.text
                  )}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          );
        })}
        
        {!disabled && tags.length < maxTags && (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-xs gap-1 border-dashed"
              >
                <Plus className="h-3 w-3" />
                Add
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="start">
              <Command>
                <CommandInput
                  placeholder={placeholder}
                  value={inputValue}
                  onValueChange={setInputValue}
                  onKeyDown={handleKeyDown}
                />
                <CommandList>
                  <CommandEmpty>
                    {inputValue.trim() ? (
                      <div
                        className="p-2 cursor-pointer hover:bg-accent text-sm flex items-center gap-2"
                        onClick={() => addTag(inputValue)}
                      >
                        <Plus className="h-3 w-3" />
                        Create "{inputValue}"
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm p-2">Type to add a tag</span>
                    )}
                  </CommandEmpty>
                  {filteredSuggestions.length > 0 && (
                    <CommandGroup heading="Suggestions">
                      {filteredSuggestions.slice(0, 10).map((suggestion) => (
                        <CommandItem
                          key={suggestion}
                          value={suggestion}
                          onSelect={() => {
                            addTag(suggestion);
                            setOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              tags.includes(suggestion) ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {suggestion}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}

// Compact tag display for cards
export function TagBadges({
  tags,
  maxDisplay = 3,
  onClick,
  className,
}: {
  tags: string[];
  maxDisplay?: number;
  onClick?: (tag: string) => void;
  className?: string;
}) {
  if (!tags || tags.length === 0) return null;

  const displayTags = tags.slice(0, maxDisplay);
  const remainingCount = tags.length - maxDisplay;

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {displayTags.map((tag) => {
        const colors = getTagColor(tag);
        return (
          <Badge
            key={tag}
            variant="outline"
            className={cn(
              "text-xs font-normal cursor-pointer hover:opacity-80",
              colors.bg,
              colors.text,
              colors.border
            )}
            onClick={(e) => {
              e.stopPropagation();
              onClick?.(tag);
            }}
          >
            {tag}
          </Badge>
        );
      })}
      {remainingCount > 0 && (
        <Badge variant="secondary" className="text-xs font-normal">
          +{remainingCount}
        </Badge>
      )}
    </div>
  );
}
