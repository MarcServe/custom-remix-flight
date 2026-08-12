export interface EmailTemplateProps {
  body: string;
  senderName: string;
  /** Name shown in the signature block only. If set, overrides senderName for the signature line. */
  signatureName?: string;
  senderEmail: string;
  senderTitle?: string;
  companyName?: string;
  headerName?: string;
  logoUrl?: string;
  /**
   * When true, logoUrl is a full-width campaign banner: natural aspect ratio,
   * never a fixed-height object-fit:cover crop (that clips on iPad/web Gmail).
   */
  headerBanner?: boolean;
  brandColor?: string;
  footerText?: string;
  signature?: string;
  footerImageUrl?: string;
  senderImageUrl?: string;
  websiteUrl?: string;
  newsletterFooterHtml?: string;
}

/**
 * Header image styles — never use object-fit:cover / fixed height.
 * Cover crops on iPad/web Gmail (mobile often ignores those rules).
 * Campaign banners: full width, natural height.
 * Logos: max-height box with contain (no crop).
 */
function headerImgStyle(headerBanner?: boolean, coverHeight = 180): string {
  if (headerBanner) {
    return 'display:block!important;width:100%!important;max-width:100%!important;height:auto!important;max-height:none!important;border:0!important;outline:none;margin:0;padding:0;-ms-interpolation-mode:bicubic;';
  }
  return `display:block;width:auto;max-width:100%;max-height:${coverHeight}px;height:auto;margin:0 auto;object-fit:contain;border:0;`;
}

function headerImgCss(headerBanner?: boolean, coverHeight = 180): string {
  if (headerBanner) {
    return `display: block !important;
      width: 100% !important;
      max-width: 100% !important;
      height: auto !important;
      max-height: none !important;
      border: 0 !important;
      outline: none;
      margin: 0;
      padding: 0;`;
  }
  return `display: block;
      width: auto;
      max-width: 100%;
      max-height: ${coverHeight}px;
      height: auto;
      margin: 0 auto;
      object-fit: contain;
      border: 0;`;
}

/** Escape attribute values used in generated email HTML. */
function escapeAttr(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Campaign banner as its own block ABOVE .email-header so header CSS
 * (padding/overflow/img rules) can never clip it on iPad/web.
 */
function renderCampaignBannerBlock(logoUrl: string | undefined, alt = ''): string {
  if (!logoUrl) return '';
  const safeSrc = escapeAttr(logoUrl);
  const safeAlt = escapeAttr(alt || '');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;width:100%;margin:0;padding:0;">
  <tr>
    <td align="center" style="padding:0!important;margin:0!important;line-height:0!important;font-size:0!important;border:0;">
      <img src="${safeSrc}" alt="${safeAlt}" width="600" border="0" style="${headerImgStyle(true)}" />
    </td>
  </tr>
</table>`;
}

/**
 * Header image. Prefer placing campaign banners via bannerAndHeaderLogo()
 * above .email-header; this helper still renders a safe full banner if called
 * with headerBanner (no cover crop).
 */
function renderHeaderImageHtml(
  logoUrl: string | undefined,
  alt: string,
  headerBanner?: boolean,
  coverHeight = 180,
): string {
  if (!logoUrl) return '';
  if (headerBanner) return renderCampaignBannerBlock(logoUrl, alt);
  const safeSrc = escapeAttr(logoUrl);
  const safeAlt = escapeAttr(alt || 'Header');
  return `<img src="${safeSrc}" alt="${safeAlt}" style="${headerImgStyle(false, coverHeight)}">`;
}

/** Top-of-email banner HTML + whether header should omit the logo img. */
function bannerAndHeaderLogo(
  logoUrl: string | undefined,
  alt: string,
  headerBanner: boolean | undefined,
  coverHeight: number,
): { bannerBlock: string; headerLogo: string } {
  if (headerBanner && logoUrl) {
    return {
      bannerBlock: renderCampaignBannerBlock(logoUrl, alt),
      headerLogo: '',
    };
  }
  return {
    bannerBlock: '',
    headerLogo: renderHeaderImageHtml(logoUrl, alt, false, coverHeight),
  };
}

function renderFooterWithImage(footerImageUrl: string | undefined, footerText: string, brandColor: string, bgStyle: string, textColor: string, newsletterFooterHtml?: string): string {
  let footerContent: string;
  if (!footerImageUrl) {
    footerContent = `<div class="email-footer" style="${bgStyle};color:${textColor};">${footerText}</div>`;
  } else {
    footerContent = `<div class="email-footer" style="${bgStyle};color:${textColor};padding:16px 28px;">
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;border-collapse:collapse;">
      <tr>
        <td style="vertical-align:middle;padding-right:14px;">
          <img src="${footerImageUrl}" alt="" style="width:48px;height:48px;border-radius:6px;object-fit:contain;display:block;border:1px solid ${brandColor}30;">
        </td>
        <td style="vertical-align:middle;text-align:left;font-size:12px;line-height:1.4;color:${textColor};">
          ${footerText}
        </td>
      </tr>
    </table>
  </div>`;
  }
  if (newsletterFooterHtml) {
    footerContent += newsletterFooterHtml;
  }
  return footerContent;
}

function renderSignatureBlock(opts: {
  signature?: string;
  senderName: string;
  /** Name shown in the signature block. Defaults to senderName. */
  signatureName?: string;
  senderTitle?: string;
  companyName?: string;
  senderEmail: string;
  websiteUrl?: string;
  nameClass?: string;
  titleClass?: string;
  companyClass?: string;
  contactClass?: string;
}): string {
  if (opts.signature) return opts.signature;

  const displayName = (opts.signatureName != null && opts.signatureName.trim() !== '') ? opts.signatureName.trim() : opts.senderName;
  const nameEl = `<div class="${opts.nameClass || 'signature-name'}">${displayName}</div>`;
  const titleEl = opts.senderTitle ? `<div class="${opts.titleClass || 'signature-title'}">${opts.senderTitle}</div>` : '';
  const companyEl = opts.companyName ? `<div class="${opts.companyClass || 'signature-company'}">${opts.companyName}</div>` : '';
  const contactEl = `<div class="${opts.contactClass || 'signature-contact'}">${opts.senderEmail}</div>`;
  const websiteEl = opts.websiteUrl ? `<div class="signature-website" style="font-size:12px;margin-top:4px;"><a href="${opts.websiteUrl.startsWith('http') ? opts.websiteUrl : 'https://' + opts.websiteUrl}" style="color:inherit;text-decoration:underline;">${opts.websiteUrl.replace(/^https?:\/\//i, '')}</a></div>` : '';
  return `${nameEl}${titleEl}${companyEl}${contactEl}${websiteEl}`;
}

/**
 * Convert plain-text email body to readable HTML with proper paragraph and list spacing.
 * - Double newlines create separate paragraphs (clear section separation).
 * - Lines starting with •, -, *, or "1." etc. become list items with spacing.
 * - Single newlines within a paragraph become <br>.
 * - Already HTML content is returned as-is.
 */
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Linkify bare URLs inside already-escaped text (keeps &amp; query params). */
function linkifyEscapedText(escaped: string): string {
  return escaped.replace(/(https?:\/\/[^\s<]+)/gi, (url) => {
    const href = url.replace(/&amp;/g, '&');
    return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" style="color:#2563eb;text-decoration:underline;word-break:break-all;">${url}</a>`;
  });
}

function bodyTextToHtml(text: string): string {
  let raw = (text || '').trim();
  if (!raw) return '';
  // If content looks like escaped HTML (e.g. &lt;p&gt;), unescape so it renders as HTML
  if (/&lt;/.test(raw) && !/<\s*[a-zA-Z]/.test(raw)) {
    raw = raw.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  }
  // Pass through any content that looks like HTML so it is never escaped —
  // but still wrap bare URLs that were never turned into <a> tags (Variant B).
  if (/<\s*[a-zA-Z]/.test(raw)) {
    return raw.replace(/(^|[^"'>=])(https?:\/\/[^\s<]+)/gi, (full, prefix, url) => {
      if (typeof prefix === 'string' && /href\s*=\s*$/i.test(prefix)) return full;
      return `${prefix}<a href="${escapeHtml(String(url).replace(/&amp;/g, '&'))}" target="_blank" rel="noopener noreferrer" style="color:#2563eb;text-decoration:underline;word-break:break-all;">${url}</a>`;
    });
  }
  const blocks = raw.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const out: string[] = [];
  for (const block of blocks) {
    const lines = block.split(/\n/).map((l) => l.trimEnd());
    const listMatch = lines.every((l) => /^(\s*)([-*•]\s*|(\d+\.)\s)/.test(l) || l === '');
    if (listMatch && lines.some(Boolean)) {
      const items = lines.filter(Boolean).map((l) => l.replace(/^(\s*)([-*•]\s*|(\d+\.)\s)/, '').trim());
      if (items.length) out.push('<ul style="margin:12px 0;padding-left:20px;">' + items.map((i) => `<li style="margin-bottom:6px;">${linkifyEscapedText(escapeHtml(i))}</li>`).join('') + '</ul>');
    } else {
      const para = lines.map((l) => linkifyEscapedText(escapeHtml(l))).join('<br>\n');
      if (para) out.push(`<p style="margin:0 0 14px 0;line-height:1.5;">${para}</p>`);
    }
  }
  return out.join('\n');
}

/** True when plain text has http(s) URLs that are missing from the HTML body. */
export function textHasUrlMissingFromHtml(text: string, html: string): boolean {
  const urls = (text || '').match(/https?:\/\/[^\s<>"')\]]+/gi) || [];
  if (!urls.length) return false;
  const normalizedHtml = (html || '').replace(/&amp;/g, '&');
  if (!normalizedHtml.trim()) return true;
  return urls.some((u) => !normalizedHtml.includes(u));
}

/** Prefer HTML, but rebuild from text when Variant B stale HTML dropped bare URLs. */
export function resolveRecipientBodyHtml(bodyHtml: string, bodyText: string): string {
  const html = (bodyHtml || '').trim();
  const text = (bodyText || '').trim();
  if (text && textHasUrlMissingFromHtml(text, html)) {
    return bodyTextToHtml(text);
  }
  if (html) return html;
  if (text) return bodyTextToHtml(text);
  return '';
}

export function renderProfessionalTemplate({
  body,
  senderName,
  signatureName,
  senderEmail,
  senderTitle,
  companyName,
  headerName,
  logoUrl,
  brandColor = '#8b5cf6',
  footerText,
  signature,
  footerImageUrl,
  senderImageUrl,
  websiteUrl,
  newsletterFooterHtml,
  headerBanner,
}: EmailTemplateProps): string {
  const displayHeaderName = (typeof headerName === 'string' && headerName.trim() !== '') ? headerName.trim() : null;
  const safeBody = body || '';
  const bodyHtml = bodyTextToHtml(safeBody);
  const alt = displayHeaderName || companyName || 'Company';
  const { bannerBlock, headerLogo } = bannerAndHeaderLogo(logoUrl, alt, headerBanner, 180);
  const hasCampaignBanner = !!(headerBanner && logoUrl);
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
      line-height: 1.35;
      color: #333333;
      margin: 0;
      padding: 0;
      background-color: #f5f5f5;
    }
    .email-container {
      width: 100%;
      max-width: 600px;
      margin: 12px auto;
      background-color: #ffffff;
      border-radius: ${hasCampaignBanner ? '0' : '8px'};
      overflow: ${hasCampaignBanner ? 'visible' : 'hidden'};
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .email-header {
      background: ${hasCampaignBanner ? 'transparent' : `linear-gradient(135deg, ${brandColor} 0%, ${brandColor}dd 100%)`};
      text-align: center;
      overflow: visible;
      line-height: ${headerLogo ? '0' : 'inherit'};
    }
    .email-header.has-logo { padding: 0; }
    .email-header.no-logo { padding: ${hasCampaignBanner && !displayHeaderName ? '0' : '20px 28px'}; }
    .email-header img { ${headerImgCss(false, 180)} }
    .email-header h1,
    .email-header .header-brand-name {
      color: ${hasCampaignBanner ? '#111827' : '#ffffff'};
      margin: 0;
      font-size: 22px;
      font-weight: 600;
    }
    .email-header .brand-name-bar {
      background: ${hasCampaignBanner ? '#f8fafc' : 'rgba(0,0,0,0.25)'};
      padding: 8px 28px;
      line-height: 1.4;
    }
    .email-body {
      padding: 18px 24px;
      color: #333333;
    }
    .email-content {
      margin-bottom: 12px;
      font-size: 15px;
      line-height: 1.4;
    }
    .email-content p, .email-content div { margin: 0 0 8px 0; }
    .email-content p:last-child, .email-content div:last-child { margin-bottom: 0; }
    .email-content ul, .email-content ol { margin: 8px 0; padding-left: 20px; }
    .email-content li { margin-bottom: 4px; }
    .email-signature {
      margin-top: 16px;
      padding-top: 12px;
      border-top: 2px solid #e5e7eb;
    }
    .signature-name {
      font-weight: 600;
      font-size: 15px;
      color: #111827;
      margin-bottom: 2px;
    }
    .signature-title {
      color: #6b7280;
      font-size: 13px;
      margin-bottom: 1px;
    }
    .signature-company {
      color: ${brandColor};
      font-weight: 600;
      font-size: 13px;
      margin-bottom: 4px;
    }
    .signature-contact {
      color: #6b7280;
      font-size: 12px;
    }
    .email-footer {
      background-color: #f9fafb;
      padding: 12px 28px;
      text-align: center;
      color: #6b7280;
      font-size: 12px;
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
    ${bannerBlock}
    ${(!hasCampaignBanner || displayHeaderName) ? `<div class="email-header ${headerLogo ? 'has-logo' : 'no-logo'}">
      ${headerLogo}
      ${displayHeaderName ? `<div class="brand-name-bar" style="background:${hasCampaignBanner ? '#f8fafc' : (headerLogo ? 'rgba(0,0,0,0.25)' : 'transparent')};padding:8px 28px;"><span class="header-brand-name">${displayHeaderName}</span></div>` : ''}
    </div>` : ''}
    
    <div class="email-body">
      <div class="email-content">
        ${bodyHtml}
      </div>
      
      ${newsletterFooterHtml ? '' : `<div class="email-signature">${renderSignatureBlock({ signature, senderName, signatureName, senderTitle, companyName, senderEmail, websiteUrl })}</div>`}
    </div>
    
    ${renderFooterWithImage(footerImageUrl, footerText || `© ${new Date().getFullYear()} ${companyName || 'Company'}. All rights reserved.`, brandColor, 'background-color:#f9fafb', '#111827', newsletterFooterHtml)}
  </div>
</body>
</html>
  `.trim();
}

export function renderMinimalTemplate({
  body,
  senderName,
  signatureName,
  senderEmail,
  senderTitle,
  companyName,
  headerName,
  logoUrl,
  brandColor = '#8b5cf6',
  footerText,
  signature,
  footerImageUrl,
  senderImageUrl,
  websiteUrl,
  newsletterFooterHtml,
  headerBanner,
}: EmailTemplateProps): string {
  const displayHeaderName = (typeof headerName === 'string' && headerName.trim() !== '') ? headerName.trim() : null;
  // Ensure body is always a string to prevent errors
  const safeBody = body || '';
  const bodyHtml = bodyTextToHtml(safeBody);
  
  const alt = displayHeaderName || companyName || 'Company';
  const { bannerBlock, headerLogo } = bannerAndHeaderLogo(logoUrl, alt, headerBanner, 160);
  const hasCampaignBanner = !!(headerBanner && logoUrl);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      line-height: 1.35;
      color: #1f2937;
      margin: 0;
      padding: 12px;
      background-color: #ffffff;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
    }
    .email-header {
      border-bottom: 1px solid #e5e7eb;
      margin-bottom: 16px;
      text-align: center;
      overflow: ${headerBanner ? 'visible' : 'hidden'};
      line-height: ${headerBanner && logoUrl ? '0' : 'inherit'};
    }
    .email-header.has-logo { padding: 0; }
    .email-header.no-logo { padding: 12px 0; }
    .email-header img { ${headerImgCss(false, 160)} }
    .email-header .header-brand-name { font-size: 18px; font-weight: 600; color: #111827; margin: 0; }
    .email-header .brand-name-bar { padding: 6px 0; }
    .email-body {
      font-size: 15px;
      line-height: 1.4;
      color: #374151;
    }
    .email-body p, .email-body div { margin: 0 0 8px 0; }
    .email-body ul, .email-body ol { margin: 8px 0; padding-left: 20px; }
    .email-body li { margin-bottom: 4px; }
    .email-signature {
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid #e5e7eb;
      font-size: 13px;
      color: #6b7280;
    }
    .signature-name {
      font-weight: 600;
      color: #111827;
      margin-bottom: 2px;
    }
    .email-footer {
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      font-size: 11px;
      color: #9ca3af;
    }
  </style>
</head>
<body>
  <div class="email-container">
    ${bannerBlock}
    ${headerLogo || displayHeaderName ? `
      <div class="email-header ${headerLogo ? 'has-logo' : 'no-logo'}">
        ${headerLogo}
        ${displayHeaderName ? `<div class="brand-name-bar" style="padding:6px 0;"><span class="header-brand-name">${displayHeaderName}</span></div>` : ''}
      </div>
    ` : ''}
    
    <div class="email-body">
      ${bodyHtml}
    </div>
    
    ${newsletterFooterHtml ? '' : `<div class="email-signature">${renderSignatureBlock({ signature, senderName, signatureName, senderTitle, companyName, senderEmail, websiteUrl })}</div>`}
    
    ${footerText || footerImageUrl || newsletterFooterHtml ? renderFooterWithImage(footerImageUrl, footerText || '', brandColor, 'background-color:#f9fafb', '#111827', newsletterFooterHtml) : ''}
  </div>
</body>
</html>
  `.trim();
}

export function renderModernTemplate({
  body,
  senderName,
  signatureName,
  senderEmail,
  senderTitle,
  companyName,
  headerName,
  logoUrl,
  brandColor = '#8b5cf6',
  footerText,
  signature,
  footerImageUrl,
  senderImageUrl,
  websiteUrl,
  newsletterFooterHtml,
  headerBanner,
}: EmailTemplateProps): string {
  const displayHeaderName = (typeof headerName === 'string' && headerName.trim() !== '') ? headerName.trim() : null;
  // Ensure body is always a string to prevent errors
  const safeBody = body || '';
  const bodyHtml = bodyTextToHtml(safeBody);
  
  const alt = displayHeaderName || companyName || 'Company';
  const { bannerBlock, headerLogo } = bannerAndHeaderLogo(logoUrl, alt, headerBanner, 180);
  const hasCampaignBanner = !!(headerBanner && logoUrl);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <style>
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      line-height: 1.35;
      color: #0f172a;
      margin: 0;
      padding: 0;
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
    }
    .email-container {
      max-width: 640px;
      margin: 16px auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: ${hasCampaignBanner ? 'visible' : 'hidden'};
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
    }
    .email-header {
      background: linear-gradient(135deg, ${brandColor}20 0%, ${brandColor}10 100%);
      position: relative;
      text-align: center;
      overflow: ${headerBanner ? 'visible' : 'hidden'};
      line-height: ${headerBanner && logoUrl ? '0' : 'inherit'};
      border-top: 4px solid ${brandColor};
    }
    .email-header.has-logo { padding: 0; }
    .email-header.no-logo { padding: 24px 28px; }
    .email-header img { ${headerImgCss(false, 180)} }
    .email-header .header-brand-name { margin: 0; color: ${brandColor}; font-size: 22px; font-weight: 700; }
    .email-header .brand-name-bar { padding: 8px 28px; }
    .email-body {
      padding: 18px 24px;
    }
    .email-content {
      font-size: 15px;
      line-height: 1.4;
      color: #334155;
      margin-bottom: 12px;
    }
    .email-content p, .email-content div { margin: 0 0 8px 0; }
    .email-content ul, .email-content ol { margin: 8px 0; padding-left: 20px; }
    .email-content li { margin-bottom: 4px; }
    .email-signature {
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      padding: 16px 20px;
      border-radius: 10px;
      border-left: 4px solid ${brandColor};
    }
    .signature-name {
      font-weight: 700;
      font-size: 15px;
      color: #0f172a;
      margin-bottom: 2px;
    }
    .signature-title {
      color: #64748b;
      font-size: 13px;
      font-weight: 500;
      margin-bottom: 1px;
    }
    .signature-company {
      color: ${brandColor};
      font-weight: 600;
      font-size: 14px;
      margin-bottom: 4px;
    }
    .signature-contact {
      color: #64748b;
      font-size: 12px;
    }
    .email-footer {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      padding: 14px 28px;
      text-align: center;
      color: #94a3b8;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="email-container">
    ${bannerBlock}
    <div class="email-header ${headerLogo ? 'has-logo' : 'no-logo'}" style="${hasCampaignBanner && !displayHeaderName ? 'display:none;padding:0;border:0;' : (hasCampaignBanner ? 'background:transparent;padding:0;' : '')}">
      ${headerLogo}
      ${displayHeaderName ? `<div class="brand-name-bar" style="padding:8px 28px;"><span class="header-brand-name">${displayHeaderName}</span></div>` : ''}
    </div>
    
    <div class="email-body">
      <div class="email-content">
        ${bodyHtml}
      </div>
      
      ${newsletterFooterHtml ? '' : `<div class="email-signature">${renderSignatureBlock({ signature, senderName, signatureName, senderTitle, companyName, senderEmail, websiteUrl })}</div>`}
    </div>
    
    ${renderFooterWithImage(footerImageUrl, footerText || `© ${new Date().getFullYear()} ${companyName || 'Company'}. All rights reserved.`, brandColor, 'background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%)', '#94a3b8', newsletterFooterHtml)}
  </div>
</body>
</html>
  `.trim();
}

/** Creative: bold, colorful, eye-catching */
export function renderCreativeTemplate({
  body,
  senderName,
  signatureName,
  senderEmail,
  senderTitle,
  companyName,
  headerName,
  logoUrl,
  brandColor = '#8b5cf6',
  footerText,
  signature,
  footerImageUrl,
  senderImageUrl,
  websiteUrl,
  newsletterFooterHtml,
  headerBanner,
}: EmailTemplateProps): string {
  const displayHeaderName = (typeof headerName === 'string' && headerName.trim() !== '') ? headerName.trim() : null;
  const safeBody = body || '';
  const bodyHtml = bodyTextToHtml(safeBody);
  const alt = displayHeaderName || companyName || 'Company';
  const { bannerBlock, headerLogo } = bannerAndHeaderLogo(logoUrl, alt, headerBanner, 200);
  const hasCampaignBanner = !!(headerBanner && logoUrl);

  const accent = brandColor;
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <style>
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; padding: 0; background: #f0f0f5; }
    .email-container { max-width: 620px; margin: 20px auto; background: #ffffff; border-radius: 20px; overflow: ${hasCampaignBanner ? 'visible' : 'hidden'}; box-shadow: 0 8px 24px rgba(0,0,0,0.1); }
    .email-header {
      background: linear-gradient(135deg, ${accent} 0%, #6366f1 50%, #8b5cf6 100%);
      text-align: center;
      overflow: ${headerBanner ? 'visible' : 'hidden'};
      line-height: ${headerBanner && logoUrl ? '0' : 'inherit'};
    }
    .email-header.has-logo { padding: 0; }
    .email-header.no-logo { padding: 28px 32px; }
    .email-header img { ${headerImgCss(false, 200)} }
    .email-header .header-brand-name { color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; text-shadow: 0 1px 2px rgba(0,0,0,0.2); }
    .email-header .brand-name-bar { background: rgba(0,0,0,0.3); padding: 10px 32px; }
    .email-body { padding: 18px 24px; color: #1f2937; }
    .email-content { font-size: 15px; line-height: 1.5; margin-bottom: 20px; }
    .email-content p, .email-content div { margin: 0 0 8px 0; }
    .email-content ul, .email-content ol { margin: 8px 0; padding-left: 20px; }
    .email-content li { margin-bottom: 4px; }
    .email-signature {
      margin-top: 20px;
      padding: 18px 22px;
      background: linear-gradient(135deg, ${accent}12 0%, ${accent}08 100%);
      border-radius: 12px;
      border-left: 5px solid ${accent};
    }
    .signature-name { font-weight: 700; font-size: 16px; color: #111827; margin-bottom: 2px; }
    .signature-title { color: #6b7280; font-size: 13px; margin-bottom: 1px; }
    .signature-company { color: ${accent}; font-weight: 700; font-size: 14px; margin-bottom: 4px; }
    .signature-contact { color: #6b7280; font-size: 12px; }
    .email-footer {
      background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
      padding: 16px 32px;
      text-align: center;
      color: #9ca3af;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="email-container">
    ${bannerBlock}
    <div class="email-header ${headerLogo ? 'has-logo' : 'no-logo'}" style="${hasCampaignBanner && !displayHeaderName ? 'display:none;padding:0;border:0;' : (hasCampaignBanner ? 'background:transparent;padding:0;' : '')}">
      ${headerLogo}
      ${displayHeaderName ? `<div class="brand-name-bar" style="background:${logoUrl ? 'rgba(0,0,0,0.3)' : 'transparent'};padding:10px 32px;"><span class="header-brand-name">${displayHeaderName}</span></div>` : ''}
    </div>
    <div class="email-body">
      <div class="email-content">${bodyHtml}</div>
      ${newsletterFooterHtml ? '' : `<div class="email-signature">${renderSignatureBlock({ signature, senderName, signatureName, senderTitle, companyName, senderEmail, websiteUrl })}</div>`}
    </div>
    ${renderFooterWithImage(footerImageUrl, footerText || `© ${new Date().getFullYear()} ${companyName || 'Company'}. All rights reserved.`, brandColor, 'background:linear-gradient(135deg,#1f2937 0%,#111827 100%)', '#9ca3af', newsletterFooterHtml)}
  </div>
</body>
</html>
  `.trim();
}

/** Corporate: traditional, trustworthy, enterprise */
export function renderCorporateTemplate({
  body,
  senderName,
  signatureName,
  senderEmail,
  senderTitle,
  companyName,
  headerName,
  logoUrl,
  brandColor = '#1e3a5f',
  footerText,
  signature,
  footerImageUrl,
  senderImageUrl,
  websiteUrl,
  newsletterFooterHtml,
  headerBanner,
}: EmailTemplateProps): string {
  const displayHeaderName = (typeof headerName === 'string' && headerName.trim() !== '') ? headerName.trim() : null;
  const safeBody = body || '';
  const bodyHtml = bodyTextToHtml(safeBody);
  const alt = displayHeaderName || companyName || 'Company';
  const { bannerBlock, headerLogo } = bannerAndHeaderLogo(logoUrl, alt, headerBanner, 180);
  const hasCampaignBanner = !!(headerBanner && logoUrl);

  const navy = '#1e3a5f';
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <style>
    body { font-family: 'Georgia', 'Times New Roman', serif; margin: 0; padding: 0; background: #f4f4f4; color: #333; }
    .email-container { max-width: 600px; margin: 24px auto; background: #ffffff; border: 1px solid #e0e0e0; }
    .email-header {
      background: ${navy};
      text-align: center;
      overflow: ${headerBanner ? 'visible' : 'hidden'};
      line-height: ${headerBanner && logoUrl ? '0' : 'inherit'};
    }
    .email-header.has-logo { padding: 0; }
    .email-header.no-logo { padding: 24px 32px; }
    .email-header img { ${headerImgCss(false, 180)} }
    .email-header .header-brand-name { color: #ffffff; margin: 0; font-size: 22px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; letter-spacing: 0.02em; }
    .email-header .brand-name-bar { background: rgba(0,0,0,0.3); padding: 8px 32px; }
    .email-body { padding: 18px 24px; font-size: 15px; line-height: 1.4; }
    .email-content { margin-bottom: 20px; }
    .email-content p, .email-content div { margin: 0 0 8px 0; }
    .email-content ul, .email-content ol { margin: 8px 0; padding-left: 20px; }
    .email-content li { margin-bottom: 4px; }
    .email-signature { margin-top: 14px; padding-top: 14px; border-top: 2px solid #e5e7eb; }
    .signature-name { font-weight: 600; font-size: 15px; color: #111827; margin-bottom: 2px; }
    .signature-title { color: #6b7280; font-size: 13px; margin-bottom: 1px; }
    .signature-company { color: ${navy}; font-weight: 600; font-size: 13px; margin-bottom: 4px; }
    .signature-contact { color: #6b7280; font-size: 12px; }
    .email-footer { background: #f9fafb; padding: 16px 32px; text-align: center; color: #6b7280; font-size: 12px; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="email-container">
    ${bannerBlock}
    <div class="email-header ${headerLogo ? 'has-logo' : 'no-logo'}" style="${hasCampaignBanner && !displayHeaderName ? 'display:none;padding:0;border:0;' : (hasCampaignBanner ? 'background:transparent;padding:0;' : '')}">
      ${headerLogo}
      ${displayHeaderName ? `<div class="brand-name-bar" style="background:${logoUrl ? 'rgba(0,0,0,0.3)' : 'transparent'};padding:8px 32px;"><span class="header-brand-name">${displayHeaderName}</span></div>` : ''}
    </div>
    <div class="email-body">
      <div class="email-content">${bodyHtml}</div>
      ${newsletterFooterHtml ? '' : `<div class="email-signature">${renderSignatureBlock({ signature, senderName, signatureName, senderTitle, companyName, senderEmail, websiteUrl })}</div>`}
    </div>
    ${renderFooterWithImage(footerImageUrl, footerText || `© ${new Date().getFullYear()} ${companyName || 'Company'}. All rights reserved.`, brandColor, 'background:#f9fafb', '#111827', newsletterFooterHtml)}
  </div>
</body>
</html>
  `.trim();
}

/** Bold: strong typography, high contrast */
export function renderBoldTemplate({
  body,
  senderName,
  signatureName,
  senderEmail,
  senderTitle,
  companyName,
  headerName,
  logoUrl,
  brandColor = '#8b5cf6',
  footerText,
  signature,
  footerImageUrl,
  senderImageUrl,
  websiteUrl,
  newsletterFooterHtml,
  headerBanner,
}: EmailTemplateProps): string {
  const displayHeaderName = (typeof headerName === 'string' && headerName.trim() !== '') ? headerName.trim() : null;
  const safeBody = body || '';
  const bodyHtml = bodyTextToHtml(safeBody);
  const alt = displayHeaderName || companyName || 'Company';
  const { bannerBlock, headerLogo } = bannerAndHeaderLogo(logoUrl, alt, headerBanner, 180);
  const hasCampaignBanner = !!(headerBanner && logoUrl);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 0; background: #0f0f0f; color: #e5e5e5; }
    .email-container { max-width: 600px; margin: 20px auto; background: #18181b; border-radius: 4px; overflow: ${hasCampaignBanner ? 'visible' : 'hidden'}; }
    .email-header {
      border-bottom: 4px solid ${brandColor};
      text-align: center;
      overflow: ${headerBanner ? 'visible' : 'hidden'};
      line-height: ${headerBanner && logoUrl ? '0' : 'inherit'};
    }
    .email-header.has-logo { padding: 0; }
    .email-header.no-logo { padding: 24px 28px; }
    .email-header img { ${headerImgCss(false, 180)} }
    .email-header .header-brand-name { color: #ffffff; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.02em; }
    .email-header .brand-name-bar { background: rgba(0,0,0,0.5); padding: 8px 28px; }
    .email-body { padding: 18px 24px; }
    .email-content { font-size: 15px; line-height: 1.4; color: #d4d4d8; margin-bottom: 12px; }
    .email-content p, .email-content div { margin: 0 0 8px 0; }
    .email-content ul, .email-content ol { margin: 8px 0; padding-left: 20px; }
    .email-content li { margin-bottom: 4px; }
    .email-signature { margin-top: 14px; padding-top: 14px; border-top: 2px solid #3f3f46; }
    .signature-name { font-weight: 700; font-size: 16px; color: #fff; margin-bottom: 2px; }
    .signature-title { color: #a1a1aa; font-size: 13px; margin-bottom: 1px; }
    .signature-company { color: ${brandColor}; font-weight: 700; font-size: 14px; margin-bottom: 4px; }
    .signature-contact { color: #a1a1aa; font-size: 12px; }
    .email-footer { padding: 16px 28px; text-align: center; color: #71717a; font-size: 12px; border-top: 1px solid #3f3f46; }
  </style>
</head>
<body>
  <div class="email-container">
    ${bannerBlock}
    <div class="email-header ${headerLogo ? 'has-logo' : 'no-logo'}" style="${hasCampaignBanner && !displayHeaderName ? 'display:none;padding:0;border:0;' : (hasCampaignBanner ? 'background:transparent;padding:0;' : '')}">
      ${headerLogo}
      ${displayHeaderName ? `<div class="brand-name-bar" style="background:${logoUrl ? 'rgba(0,0,0,0.5)' : 'transparent'};padding:8px 28px;"><span class="header-brand-name">${displayHeaderName}</span></div>` : ''}
    </div>
    <div class="email-body">
      <div class="email-content">${bodyHtml}</div>
      ${newsletterFooterHtml ? '' : `<div class="email-signature">${renderSignatureBlock({ signature, senderName, signatureName, senderTitle, companyName, senderEmail, websiteUrl })}</div>`}
    </div>
    ${renderFooterWithImage(footerImageUrl, footerText || `© ${new Date().getFullYear()} ${companyName || 'Company'}. All rights reserved.`, brandColor, 'background:#27272a', '#a1a1aa', newsletterFooterHtml)}
  </div>
</body>
</html>
  `.trim();
}

/** Elegant: refined, serif, subtle accent */
export function renderElegantTemplate({
  body,
  senderName,
  signatureName,
  senderEmail,
  senderTitle,
  companyName,
  headerName,
  logoUrl,
  brandColor = '#6b5b4f',
  footerText,
  signature,
  footerImageUrl,
  senderImageUrl,
  websiteUrl,
  newsletterFooterHtml,
  headerBanner,
}: EmailTemplateProps): string {
  const displayHeaderName = (typeof headerName === 'string' && headerName.trim() !== '') ? headerName.trim() : null;
  const safeBody = body || '';
  const bodyHtml = bodyTextToHtml(safeBody);
  const alt = displayHeaderName || companyName || 'Company';
  const { bannerBlock, headerLogo } = bannerAndHeaderLogo(logoUrl, alt, headerBanner, 180);
  const hasCampaignBanner = !!(headerBanner && logoUrl);

  const sepia = '#6b5b4f';
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <style>
    body { font-family: 'Georgia', 'Times New Roman', serif; margin: 0; padding: 0; background: #faf9f7; color: #3d3d3d; }
    .email-container { max-width: 580px; margin: 28px auto; background: #ffffff; border: 1px solid #e8e4df; box-shadow: 0 2px 12px rgba(107,91,79,0.08); }
    .email-header { border-bottom: 1px solid #e8e4df; text-align: center; overflow: ${headerBanner ? 'visible' : 'hidden'}; line-height: ${headerBanner && logoUrl ? '0' : 'inherit'}; }
    .email-header.has-logo { padding: 0; }
    .email-header.no-logo { padding: 28px 32px; }
    .email-header img { ${headerImgCss(false, 180)} }
    .email-header .header-brand-name { margin: 0; font-size: 22px; font-weight: 600; color: ${sepia}; letter-spacing: 0.04em; }
    .email-header .brand-name-bar { padding: 8px 32px; background: #faf9f7; }
    .email-body { padding: 18px 24px; font-size: 15px; line-height: 1.4; }
    .email-content { margin-bottom: 24px; }
    .email-content p, .email-content div { margin: 0 0 8px 0; }
    .email-content ul, .email-content ol { margin: 8px 0; padding-left: 20px; }
    .email-content li { margin-bottom: 4px; }
    .email-signature { margin-top: 28px; padding-top: 20px; border-top: 1px solid #e8e4df; }
    .signature-name { font-weight: 600; font-size: 15px; color: #2d2d2d; margin-bottom: 2px; }
    .signature-title { color: #6b5b4f; font-size: 13px; font-style: italic; margin-bottom: 1px; }
    .signature-company { color: ${sepia}; font-weight: 600; font-size: 13px; margin-bottom: 4px; }
    .signature-contact { color: #6b7280; font-size: 12px; }
    .email-footer { padding: 20px 36px; text-align: center; color: #9ca3af; font-size: 12px; border-top: 1px solid #e8e4df; background: #faf9f7; }
  </style>
</head>
<body>
  <div class="email-container">
    ${bannerBlock}
    <div class="email-header ${headerLogo ? 'has-logo' : 'no-logo'}" style="${hasCampaignBanner && !displayHeaderName ? 'display:none;padding:0;border:0;' : (hasCampaignBanner ? 'background:transparent;padding:0;' : '')}">
      ${headerLogo}
      ${displayHeaderName ? `<div class="brand-name-bar" style="padding:8px 32px;background:#faf9f7;"><span class="header-brand-name">${displayHeaderName}</span></div>` : ''}
    </div>
    <div class="email-body">
      <div class="email-content">${bodyHtml}</div>
      ${newsletterFooterHtml ? '' : `<div class="email-signature">${renderSignatureBlock({ signature, senderName, signatureName, senderTitle, companyName, senderEmail, websiteUrl })}</div>`}
    </div>
    ${renderFooterWithImage(footerImageUrl, footerText || `© ${new Date().getFullYear()} ${companyName || 'Company'}. All rights reserved.`, brandColor, 'background:#faf9f7', '#111827', newsletterFooterHtml)}
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
    case 'creative':
      return renderCreativeTemplate(props);
    case 'corporate':
      return renderCorporateTemplate(props);
    case 'bold':
      return renderBoldTemplate(props);
    case 'elegant':
      return renderElegantTemplate(props);
    case 'professional':
    default:
      return renderProfessionalTemplate(props);
  }
}