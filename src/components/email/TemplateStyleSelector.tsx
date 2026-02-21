import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";

export const EMAIL_TEMPLATE_STYLES = {
  professional: {
    name: "Professional",
    description: "Classic & Polished - Clean design with formal styling",
  },
  modern: {
    name: "Modern",
    description: "Contemporary & Sleek - Bold colors and modern typography",
  },
  minimal: {
    name: "Minimal",
    description: "Simple & Clean - Minimal styling with focus on content",
  },
  creative: {
    name: "Creative",
    description: "Bold & Expressive - Colorful and eye-catching design",
  },
  corporate: {
    name: "Corporate",
    description: "Traditional & Trustworthy - Enterprise-level professional styling",
  },
  bold: {
    name: "Bold",
    description: "High contrast & strong typography - Dark theme, accent bar",
  },
  elegant: {
    name: "Elegant",
    description: "Refined & timeless - Serif typography, subtle accents",
  },
} as const;

export type EmailTemplateStyle = keyof typeof EMAIL_TEMPLATE_STYLES;

interface TemplateStyleSelectorProps {
  value: EmailTemplateStyle;
  onChange: (value: EmailTemplateStyle) => void;
  disabled?: boolean;
  showPreview?: boolean;
}

export function TemplateStyleSelector({
  value,
  onChange,
  disabled = false,
  showPreview = true,
}: TemplateStyleSelectorProps) {
  return (
    <div className="space-y-3">
      <Label htmlFor="template-style">Email Template Style</Label>
      <Select
        value={value}
        onValueChange={(val) => onChange(val as EmailTemplateStyle)}
        disabled={disabled}
      >
        <SelectTrigger id="template-style">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(EMAIL_TEMPLATE_STYLES).map(([key, style]) => (
            <SelectItem key={key} value={key}>
              <div className="flex flex-col">
                <span className="font-medium">{style.name}</span>
                <span className="text-xs text-muted-foreground">
                  {style.description}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {showPreview && (
        <Card className="p-4 bg-muted/50">
          <div className="space-y-2">
            <p className="text-sm font-medium">
              {EMAIL_TEMPLATE_STYLES[value].name}
            </p>
            <p className="text-xs text-muted-foreground">
              {EMAIL_TEMPLATE_STYLES[value].description}
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
