/**
 * Professional email wrapper with styling
 */
export function wrapEmailContent(bodyHtml: string, senderName: string, senderEmail: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
      line-height: 1.4;
      color: #333;
      background-color: #f5f5f5;
      margin: 0;
      padding: 0;
    }
    .email-container {
      max-width: 600px;
      margin: 12px auto;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    .email-content {
      padding: 18px 24px;
      line-height: 1.4;
    }
    .email-content p, .email-content div {
      margin: 0 0 8px 0;
    }
    .email-content p:last-child, .email-content div:last-child { margin-bottom: 0; }
    .email-content ul,
    .email-content ol {
      margin: 8px 0;
      padding-left: 20px;
    }
    .email-content li {
      margin-bottom: 4px;
    }
    .email-content strong {
      font-weight: 600;
      color: #1a1a1a;
    }
    .email-content em {
      font-style: italic;
    }
    .signature {
      margin-top: 14px;
      padding-top: 10px;
      border-top: 1px solid #e9ecef;
    }
    .signature-name {
      font-weight: 600;
      color: #333;
      margin-bottom: 2px;
    }
    .signature-email {
      color: #6c757d;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-content">
      ${bodyHtml}
      
      <div class="signature">
        <div class="signature-name">${senderName}</div>
        <div class="signature-email">${senderEmail}</div>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}