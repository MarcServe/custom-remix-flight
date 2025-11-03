import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface QuickReplyTemplatesProps {
  onSelect: (subject: string, body: string) => void;
}

const TEMPLATES = [
  {
    label: "Follow Up",
    subject: "Following up on our conversation",
    body: "Hi,\n\nI wanted to follow up on our previous conversation. Do you have any questions or need any additional information?\n\nLooking forward to hearing from you.\n\nBest regards"
  },
  {
    label: "Thank You",
    subject: "Thank you",
    body: "Hi,\n\nThank you for your email. I appreciate you taking the time to reach out.\n\nBest regards"
  },
  {
    label: "Schedule Meeting",
    subject: "Let's schedule a meeting",
    body: "Hi,\n\nI'd love to schedule a meeting to discuss this further. Are you available for a call this week?\n\nPlease let me know what times work best for you.\n\nBest regards"
  },
  {
    label: "More Info",
    subject: "Additional information",
    body: "Hi,\n\nThank you for your interest. I'd be happy to provide more information about this.\n\nCould you let me know specifically what aspects you'd like to learn more about?\n\nBest regards"
  }
];

export function QuickReplyTemplates({ onSelect }: QuickReplyTemplatesProps) {
  return (
    <Card className="p-3">
      <p className="text-xs font-medium mb-2 text-muted-foreground">Quick Templates</p>
      <div className="flex flex-wrap gap-2">
        {TEMPLATES.map((template) => (
          <Button
            key={template.label}
            variant="outline"
            size="sm"
            onClick={() => onSelect(template.subject, template.body)}
          >
            {template.label}
          </Button>
        ))}
      </div>
    </Card>
  );
}
