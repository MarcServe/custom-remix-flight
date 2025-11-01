export interface EmailTemplateProps {
  body: string;
  senderName: string;
  senderEmail: string;
  senderTitle?: string;
  companyName?: string;
  logoUrl?: string;
  brandColor?: string;
  footerText?: string;
  signature?: string;
}

export function renderProfessionalTemplate({
  body,
  senderName,
  senderEmail,
  senderTitle,
  companyName,
  logoUrl,
  brandColor = '#8b5cf6',
  footerText,
  signature,
}: EmailTemplateProps): string {
  const bodyHtml = body.replace(/\n/g, '<br>');
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
      line-height: 1.6;
      color: #333333;
      margin: 0;
      padding: 0;
      background-color: #f5f5f5;
    }
    .email-container {
      max-width: 600px;
      margin: 20px auto;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .email-header {
      background: linear-gradient(135deg, ${brandColor} 0%, ${brandColor}dd 100%);
      padding: 30px 40px;
      text-align: center;
    }
    .email-header img {
      max-width: 180px;
      max-height: 60px;
      margin-bottom: 10px;
    }
    .email-header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .email-body {
      padding: 40px;
      color: #333333;
    }
    .email-content {
      margin-bottom: 30px;
      font-size: 15px;
      line-height: 1.8;
    }
    .email-signature {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 2px solid #e5e7eb;
    }
    .signature-name {
      font-weight: 600;
      font-size: 16px;
      color: #111827;
      margin-bottom: 4px;
    }
    .signature-title {
      color: #6b7280;
      font-size: 14px;
      margin-bottom: 2px;
    }
    .signature-company {
      color: ${brandColor};
      font-weight: 600;
      font-size: 14px;
      margin-bottom: 8px;
    }
    .signature-contact {
      color: #6b7280;
      font-size: 13px;
    }
    .email-footer {
      background-color: #f9fafb;
      padding: 20px 40px;
      text-align: center;
      color: #6b7280;
      font-size: 13px;
      border-top: 1px solid #e5e7eb;
    }
    .email-footer a {
      color: ${brandColor};
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      ${logoUrl ? `<img src="${logoUrl}" alt="${companyName || 'Company'} Logo">` : ''}
      ${!logoUrl && companyName ? `<h1>${companyName}</h1>` : ''}
    </div>
    
    <div class="email-body">
      <div class="email-content">
        ${bodyHtml}
      </div>
      
      <div class="email-signature">
        ${signature ? signature : `
          <div class="signature-name">${senderName}</div>
          ${senderTitle ? `<div class="signature-title">${senderTitle}</div>` : ''}
          ${companyName ? `<div class="signature-company">${companyName}</div>` : ''}
          <div class="signature-contact">${senderEmail}</div>
        `}
      </div>
    </div>
    
    <div class="email-footer">
      ${footerText || `© ${new Date().getFullYear()} ${companyName || 'Company'}. All rights reserved.`}
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function renderMinimalTemplate({
  body,
  senderName,
  senderEmail,
  senderTitle,
  companyName,
  logoUrl,
  brandColor = '#8b5cf6',
  footerText,
  signature,
}: EmailTemplateProps): string {
  const bodyHtml = body.replace(/\n/g, '<br>');
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      line-height: 1.6;
      color: #1f2937;
      margin: 0;
      padding: 20px;
      background-color: #ffffff;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
    }
    .email-header {
      padding: 20px 0;
      border-bottom: 1px solid #e5e7eb;
      margin-bottom: 30px;
    }
    .email-header img {
      max-width: 120px;
      max-height: 40px;
    }
    .email-body {
      font-size: 15px;
      line-height: 1.7;
      color: #374151;
    }
    .email-signature {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 14px;
      color: #6b7280;
    }
    .signature-name {
      font-weight: 600;
      color: #111827;
      margin-bottom: 4px;
    }
    .email-footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      font-size: 12px;
      color: #9ca3af;
    }
  </style>
</head>
<body>
  <div class="email-container">
    ${logoUrl || companyName ? `
      <div class="email-header">
        ${logoUrl ? `<img src="${logoUrl}" alt="${companyName || 'Company'} Logo">` : ''}
        ${!logoUrl && companyName ? companyName : ''}
      </div>
    ` : ''}
    
    <div class="email-body">
      ${bodyHtml}
    </div>
    
    <div class="email-signature">
      ${signature ? signature : `
        <div class="signature-name">${senderName}</div>
        ${senderTitle ? `<div>${senderTitle}</div>` : ''}
        ${companyName ? `<div>${companyName}</div>` : ''}
        <div>${senderEmail}</div>
      `}
    </div>
    
    ${footerText ? `<div class="email-footer">${footerText}</div>` : ''}
  </div>
</body>
</html>
  `.trim();
}

export function renderModernTemplate({
  body,
  senderName,
  senderEmail,
  senderTitle,
  companyName,
  logoUrl,
  brandColor = '#8b5cf6',
  footerText,
  signature,
}: EmailTemplateProps): string {
  const bodyHtml = body.replace(/\n/g, '<br>');
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      line-height: 1.6;
      color: #0f172a;
      margin: 0;
      padding: 0;
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
    }
    .email-container {
      max-width: 640px;
      margin: 40px auto;
      background-color: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
    }
    .email-header {
      background: linear-gradient(135deg, ${brandColor}20 0%, ${brandColor}10 100%);
      padding: 40px;
      position: relative;
    }
    .email-header::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: ${brandColor};
    }
    .email-header img {
      max-width: 160px;
      max-height: 50px;
    }
    .email-body {
      padding: 40px;
    }
    .email-content {
      font-size: 15px;
      line-height: 1.8;
      color: #334155;
      margin-bottom: 32px;
    }
    .email-signature {
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      padding: 24px;
      border-radius: 12px;
      border-left: 4px solid ${brandColor};
    }
    .signature-name {
      font-weight: 700;
      font-size: 17px;
      color: #0f172a;
      margin-bottom: 4px;
    }
    .signature-title {
      color: #64748b;
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 2px;
    }
    .signature-company {
      color: ${brandColor};
      font-weight: 600;
      font-size: 15px;
      margin-bottom: 8px;
    }
    .signature-contact {
      color: #64748b;
      font-size: 13px;
    }
    .email-footer {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      padding: 24px 40px;
      text-align: center;
      color: #94a3b8;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      ${logoUrl ? `<img src="${logoUrl}" alt="${companyName || 'Company'} Logo">` : ''}
      ${!logoUrl && companyName ? `<h2 style="margin:0;color:${brandColor};font-size:24px;">${companyName}</h2>` : ''}
    </div>
    
    <div class="email-body">
      <div class="email-content">
        ${bodyHtml}
      </div>
      
      <div class="email-signature">
        ${signature ? signature : `
          <div class="signature-name">${senderName}</div>
          ${senderTitle ? `<div class="signature-title">${senderTitle}</div>` : ''}
          ${companyName ? `<div class="signature-company">${companyName}</div>` : ''}
          <div class="signature-contact">${senderEmail}</div>
        `}
      </div>
    </div>
    
    <div class="email-footer">
      ${footerText || `© ${new Date().getFullYear()} ${companyName || 'Company'}. All rights reserved.`}
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function renderEmailTemplate(style: string, props: EmailTemplateProps): string {
  switch (style) {
    case 'minimal':
      return renderMinimalTemplate(props);
    case 'modern':
      return renderModernTemplate(props);
    case 'professional':
    default:
      return renderProfessionalTemplate(props);
  }
}