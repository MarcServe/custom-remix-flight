import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

export type EmailTemplate = 'blank' | 'introduction' | 'follow-up' | 'meeting-request';

interface EmailTemplateSelectorProps {
  value: EmailTemplate;
  onChange: (template: EmailTemplate) => void;
  disabled?: boolean;
}

export function EmailTemplateSelector({ value, onChange, disabled }: EmailTemplateSelectorProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="template">Email Template</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id="template">
          <SelectValue placeholder="Select a template" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="blank">
            <div className="flex flex-col">
              <span className="font-medium">Blank</span>
              <span className="text-xs text-muted-foreground">Start from scratch</span>
            </div>
          </SelectItem>
          <SelectItem value="introduction">
            <div className="flex flex-col">
              <span className="font-medium">Introduction</span>
              <span className="text-xs text-muted-foreground">Introduce yourself and your business</span>
            </div>
          </SelectItem>
          <SelectItem value="follow-up">
            <div className="flex flex-col">
              <span className="font-medium">Follow-Up</span>
              <span className="text-xs text-muted-foreground">Check in after initial contact</span>
            </div>
          </SelectItem>
          <SelectItem value="meeting-request">
            <div className="flex flex-col">
              <span className="font-medium">Meeting Request</span>
              <span className="text-xs text-muted-foreground">Request a call or meeting</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export const EMAIL_TEMPLATES: Record<EmailTemplate, { subject: string; body: string }> = {
  blank: {
    subject: '',
    body: '',
  },
  introduction: {
    subject: 'Quick Introduction',
    body: `<p>Hi {{firstName}},</p>

<p>I hope this email finds you well. I wanted to reach out and introduce myself.</p>

<p>I'm reaching out because I believe we could help {{companyName}} with...</p>

<p><strong>Here's what we offer:</strong></p>
<ul>
  <li>Benefit 1</li>
  <li>Benefit 2</li>
  <li>Benefit 3</li>
</ul>

<p>Would you be open to a brief conversation to explore how we might work together?</p>

<p>Looking forward to hearing from you!</p>`,
  },
  'follow-up': {
    subject: 'Following up on my previous email',
    body: `<p>Hi {{firstName}},</p>

<p>I wanted to follow up on my previous email about how we could potentially help {{companyName}}.</p>

<p>I understand you're busy, but I believe this could be valuable for your team. Would you have 15 minutes this week for a quick call?</p>

<p>Let me know what works best for your schedule.</p>`,
  },
  'meeting-request': {
    subject: 'Quick meeting request',
    body: `<p>Hi {{firstName}},</p>

<p>I'd love to schedule a brief call to discuss how we can help {{companyName}} achieve its goals.</p>

<p><strong>Meeting Details:</strong></p>
<ul>
  <li>Duration: 15-20 minutes</li>
  <li>Format: Video call or phone</li>
  <li>Agenda: [Brief overview]</li>
</ul>

<p>Are you available this week? I'm flexible with timing and happy to work around your schedule.</p>

<p>Looking forward to connecting!</p>`,
  },
};
