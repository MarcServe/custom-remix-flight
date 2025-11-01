/**
 * Professional email template
 * Converts HTML content to a well-formatted email with proper styling
 */

interface TemplateProps {
  subject: string;
  body: string;
  senderName: string;
  senderEmail: string;
}

export function renderProfessionalEmail({ subject, body, senderName, senderEmail }: TemplateProps): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f5f5f5;
      margin: 0;
      padding: 0;
    }
    .email-container {
      max-width: 600px;
      margin: 20px auto;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    .email-content {
      padding: 30px;
    }
    .email-content p {
      margin: 0 0 16px 0;
    }
    .email-content ul,
    .email-content ol {
      margin: 0 0 16px 0;
      padding-left: 24px;
    }
    .email-content li {
      margin-bottom: 8px;
    }
    .email-content strong {
      font-weight: 600;
    }
    .email-content em {
      font-style: italic;
    }
    .email-footer {
      padding: 20px 30px;
      background-color: #f8f9fa;
      border-top: 1px solid #e9ecef;
      font-size: 13px;
      color: #6c757d;
    }
    .signature {
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid #e9ecef;
    }
    .signature-name {
      font-weight: 600;
      color: #333;
      margin-bottom: 4px;
    }
    .signature-email {
      color: #6c757d;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-content">
      ${body}
      
      <div class="signature">
        <div class="signature-name">${senderName}</div>
        <div class="signature-email">${senderEmail}</div>
      </div>
    </div>
    <div class="email-footer">
      This email was sent by ${senderName}. If you'd like to unsubscribe from future emails, please reply with "unsubscribe".
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generate plain text version from HTML
 */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}
