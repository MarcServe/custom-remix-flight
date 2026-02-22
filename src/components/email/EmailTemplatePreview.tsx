import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail } from 'lucide-react';

export type EmailTemplatePreviewStyle = 'professional' | 'minimal' | 'modern' | 'creative' | 'corporate' | 'bold' | 'elegant';

interface EmailTemplatePreviewProps {
  template: EmailTemplatePreviewStyle;
  brandColor: string;
  logoUrl?: string;
  companyName?: string;
  headerName?: string;
  senderName?: string;
  senderTitle?: string;
  senderEmail?: string;
  footerText?: string;
  footerImageUrl?: string;
  senderImageUrl?: string;
  websiteUrl?: string;
  /** When set, overrides the default name/title/company/email signature block with this HTML */
  signature?: string;
  headerExtra?: React.ReactNode;
  bodyHtml?: string;
  bare?: boolean;
  /** When set (e.g. newsletter preview), clicking an image in the body calls this with (src, index) */
  onEditImage?: (src: string, index: number) => void;
}

export function EmailTemplatePreview({
  template,
  brandColor,
  logoUrl,
  companyName = 'Your Company',
  headerName,
  senderName = 'John Doe',
  senderTitle = 'Sales Representative',
  senderEmail = 'john@company.com',
  footerText,
  footerImageUrl,
  senderImageUrl,
  websiteUrl,
  signature: customSignature,
  headerExtra,
  bodyHtml,
  bare,
  onEditImage,
}: EmailTemplatePreviewProps) {
  const displayHeaderName = (headerName != null && String(headerName).trim() !== '') ? String(headerName).trim() : undefined;

  const renderNewsletterExtra = () => {
    if (!bare) return null;
    const displayUrl = websiteUrl ? websiteUrl.replace(/^https?:\/\//i, '') : '';
    const fullUrl = websiteUrl ? (websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`) : '';
    return (
      <div style={{ borderTop: '1px solid #e5e7eb', marginTop: '8px', padding: '20px 28px 16px', textAlign: 'center' as const }}>
        <p style={{ margin: '0 0 6px', fontSize: '12px', color: '#6b7280', lineHeight: 1.5 }}>
          You received this because you subscribed to <strong>{companyName}</strong> newsletters.
        </p>
        {fullUrl && (
          <p style={{ margin: '0 0 10px', fontSize: '12px' }}>
            <a href={fullUrl} style={{ color: brandColor, textDecoration: 'underline' }}>{displayUrl}</a>
          </p>
        )}
        <p style={{ margin: 0, fontSize: '11px' }}>
          <a href="#" style={{ color: '#9ca3af', textDecoration: 'underline' }}>Unsubscribe</a>
          <span style={{ color: '#d1d5db', margin: '0 6px' }}>|</span>
          <a href={`mailto:${senderEmail}`} style={{ color: '#9ca3af', textDecoration: 'underline' }}>Contact us</a>
        </p>
      </div>
    );
  };

  const renderFooter = (text: string, bgColor: string, textColor: string, borderColor?: string) => {
    const newsletterExtra = renderNewsletterExtra();
    if (!footerImageUrl) {
      return (
        <>
          <div style={{ backgroundColor: bgColor, padding: '16px 28px', textAlign: 'center' as const, color: textColor, fontSize: '12px', borderTop: borderColor ? `1px solid ${borderColor}` : undefined }}>
            {text}
          </div>
          {newsletterExtra}
        </>
      );
    }
    return (
      <>
        <div style={{ backgroundColor: bgColor, padding: '16px 28px', borderTop: borderColor ? `1px solid ${borderColor}` : undefined }}>
          <table style={{ margin: '0 auto', borderCollapse: 'collapse' as const }}>
            <tbody>
              <tr>
                <td style={{ verticalAlign: 'middle', paddingRight: '14px' }}>
                  <img src={footerImageUrl} alt="" style={{ width: '48px', height: '48px', borderRadius: '6px', objectFit: 'contain' as const, display: 'block', border: `1px solid ${brandColor}30` }} />
                </td>
                <td style={{ verticalAlign: 'middle', textAlign: 'left' as const, fontSize: '12px', lineHeight: 1.4, color: textColor }}>
                  {text}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        {newsletterExtra}
      </>
    );
  };

  const defaultFooter = footerText || `© ${new Date().getFullYear()} ${companyName}. All rights reserved.`;

  const bodyLines = [
    'Hi [Name],',
    '',
    'Thank you for your interest! I wanted to follow up on our previous conversation about how we can help your business grow.',
    '',
    'We specialize in providing innovative solutions that have helped companies like yours achieve remarkable results.',
    '',
    'Would you be available for a 15-minute call this week?',
    '',
    'Looking forward to connecting!',
  ];

  const handleBodyClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!bare || !onEditImage) return;
    const target = e.target;
    if (target instanceof HTMLImageElement) {
      const container = e.currentTarget;
      const imgs = container.querySelectorAll('img');
      const index = Array.from(imgs).indexOf(target);
      if (index >= 0) onEditImage(target.getAttribute('src') || target.src, index);
    }
  };

  const renderBody = (color: string) => {
    if (bodyHtml) {
      const bodyContent = <div style={{ color, fontSize: '15px', lineHeight: '1.6' }} dangerouslySetInnerHTML={{ __html: bodyHtml }} />;
      if (bare && onEditImage) {
        return (
          <div onClick={handleBodyClick} style={{ cursor: onEditImage ? 'pointer' : undefined }} title="Click image to edit">
            {bodyContent}
          </div>
        );
      }
      return bodyContent;
    }
    return (
      <div>
        {bodyLines.map((line, i) => (
          <div key={i} style={{ marginBottom: line === '' ? '12px' : '0', color, fontSize: '15px', lineHeight: '1.6' }}>
            {line || <br />}
          </div>
        ))}
      </div>
    );
  };

  const renderHeader = (bg: string, nameColor: string, overlayBg?: string) => (
    <div style={{ background: bg, padding: logoUrl ? '0' : '24px 28px', textAlign: 'center' as const, overflow: 'hidden' }}>
      {logoUrl && <img src={logoUrl} alt="" style={{ width: '100%', maxHeight: '180px', display: 'block', objectFit: 'cover' as const }} />}
      {displayHeaderName && (
        <div style={{ background: overlayBg || 'transparent', padding: '8px 28px' }}>
          <span style={{ color: nameColor, fontSize: '22px', fontWeight: 600, margin: 0 }}>{displayHeaderName}</span>
        </div>
      )}
    </div>
  );

  const renderSignature = (nameCl: string, titleCl: string, companyCl: string, contactCl: string, style?: React.CSSProperties) => {
    if (bare) return null;

    const wrapperStyle = { marginTop: '24px', paddingTop: '16px', borderTop: '2px solid #e5e7eb', ...style } as React.CSSProperties;

    if (customSignature && String(customSignature).trim() !== '') {
      const customContent = <div style={{ fontSize: '14px', lineHeight: 1.5 }} dangerouslySetInnerHTML={{ __html: customSignature.trim() }} />;
      return (
        <div style={wrapperStyle} className="email-signature-custom">
          {customContent}
        </div>
      );
    }

    const displayUrl = websiteUrl ? (websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`) : '';
    const displayUrlLabel = websiteUrl ? websiteUrl.replace(/^https?:\/\//i, '') : '';
    const textBlock = (
      <div>
        <div style={{ fontWeight: 600, fontSize: '15px', color: nameCl, marginBottom: '2px' }}>{senderName}</div>
        {senderTitle && <div style={{ color: titleCl, fontSize: '13px', marginBottom: '1px' }}>{senderTitle}</div>}
        {companyName && <div style={{ color: companyCl, fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>{companyName}</div>}
        <div style={{ color: contactCl, fontSize: '12px' }}>{senderEmail}</div>
        {displayUrl && (
          <div style={{ fontSize: '12px', marginTop: '4px' }}>
            <a href={displayUrl} style={{ color: 'inherit', textDecoration: 'underline' }}>{displayUrlLabel}</a>
          </div>
        )}
      </div>
    );

    return (
      <div style={wrapperStyle}>
        {textBlock}
      </div>
    );
  };

  // ── Professional ──
  const renderProfessional = () => (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', maxWidth: '600px', margin: '0 auto', backgroundColor: '#ffffff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
      {renderHeader(`linear-gradient(135deg, ${brandColor} 0%, ${brandColor}dd 100%)`, '#ffffff', logoUrl ? 'rgba(0,0,0,0.25)' : undefined)}
      <div style={{ padding: '24px 32px' }}>
        {renderBody('#333333')}
        {renderSignature('#111827', '#6b7280', brandColor, '#6b7280')}
      </div>
      {renderFooter(defaultFooter, '#f9fafb', '#6b7280', '#e5e7eb')}
    </div>
  );

  // ── Minimal ──
  const renderMinimal = () => (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
      {(logoUrl || displayHeaderName) && (
        <div style={{ borderBottom: '1px solid #e5e7eb', marginBottom: '24px', overflow: 'hidden', textAlign: 'center' as const, padding: logoUrl ? '0' : '12px 0 16px 0' }}>
          {logoUrl && <img src={logoUrl} alt="" style={{ width: '100%', maxHeight: '160px', display: 'block', objectFit: 'cover' as const }} />}
          {displayHeaderName && <div style={{ padding: '6px 0' }}><span style={{ fontSize: '18px', fontWeight: 600, color: '#111827' }}>{displayHeaderName}</span></div>}
        </div>
      )}
      {renderBody('#374151')}
      {renderSignature('#111827', '#6b7280', '#6b7280', '#6b7280', { marginTop: '32px', paddingTop: '16px', borderTop: '1px solid #e5e7eb', fontSize: '13px', color: '#6b7280' })}
      {(footerText || footerImageUrl) && renderFooter(footerText || '', 'transparent', '#9ca3af')}
    </div>
  );

  // ── Modern ──
  const renderModern = () => (
    <div style={{ fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif', maxWidth: '640px', margin: '16px auto', backgroundColor: '#ffffff', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
      <div style={{ background: `linear-gradient(135deg, ${brandColor}20 0%, ${brandColor}10 100%)`, padding: logoUrl ? '0' : '24px 28px', borderTop: `4px solid ${brandColor}`, textAlign: 'center' as const, overflow: 'hidden' }}>
        {logoUrl && <img src={logoUrl} alt="" style={{ width: '100%', maxHeight: '180px', display: 'block', objectFit: 'cover' as const }} />}
        {displayHeaderName && <div style={{ padding: '8px 28px' }}><span style={{ color: brandColor, fontSize: '22px', fontWeight: 700 }}>{displayHeaderName}</span></div>}
      </div>
      <div style={{ padding: '24px 32px' }}>
        {renderBody('#334155')}
        {renderSignature('#0f172a', '#64748b', brandColor, '#64748b', { marginTop: '24px', paddingTop: 0, padding: '20px', background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', borderRadius: '10px', borderLeft: `4px solid ${brandColor}`, borderTop: 'none' })}
      </div>
      {renderFooter(defaultFooter, '#0f172a', '#94a3b8')}
    </div>
  );

  // ── Creative ──
  const renderCreative = () => (
    <div style={{ fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif', maxWidth: '620px', margin: '20px auto', backgroundColor: '#ffffff', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}>
      <div style={{ background: `linear-gradient(135deg, ${brandColor} 0%, #6366f1 50%, #8b5cf6 100%)`, padding: logoUrl ? '0' : '28px 32px', textAlign: 'center' as const, overflow: 'hidden' }}>
        {logoUrl && <img src={logoUrl} alt="" style={{ width: '100%', maxHeight: '200px', display: 'block', objectFit: 'cover' as const }} />}
        {displayHeaderName && (
          <div style={{ background: logoUrl ? 'rgba(0,0,0,0.3)' : 'transparent', padding: '10px 32px' }}>
            <span style={{ color: '#ffffff', fontSize: '24px', fontWeight: 700, textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>{displayHeaderName}</span>
          </div>
        )}
      </div>
      <div style={{ padding: '24px 32px' }}>
        {renderBody('#1f2937')}
        {renderSignature('#111827', '#6b7280', brandColor, '#6b7280', { marginTop: '24px', paddingTop: 0, padding: '18px 22px', background: `linear-gradient(135deg, ${brandColor}12 0%, ${brandColor}08 100%)`, borderRadius: '12px', borderLeft: `5px solid ${brandColor}`, borderTop: 'none' })}
      </div>
      {renderFooter(defaultFooter, '#1f2937', '#9ca3af')}
    </div>
  );

  // ── Corporate ──
  const renderCorporate = () => (
    <div style={{ fontFamily: 'Georgia, "Times New Roman", serif', maxWidth: '600px', margin: '24px auto', backgroundColor: '#ffffff', border: '1px solid #e0e0e0' }}>
      <div style={{ background: '#1e3a5f', padding: logoUrl ? '0' : '24px 32px', textAlign: 'center' as const, overflow: 'hidden' }}>
        {logoUrl && <img src={logoUrl} alt="" style={{ width: '100%', maxHeight: '180px', display: 'block', objectFit: 'cover' as const }} />}
        {displayHeaderName && (
          <div style={{ background: logoUrl ? 'rgba(0,0,0,0.3)' : 'transparent', padding: '8px 32px' }}>
            <span style={{ color: '#ffffff', fontSize: '22px', fontWeight: 600, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', letterSpacing: '0.02em' }}>{displayHeaderName}</span>
          </div>
        )}
      </div>
      <div style={{ padding: '24px 32px', fontSize: '15px', lineHeight: '1.6' }}>
        {renderBody('#333333')}
        {renderSignature('#111827', '#6b7280', '#1e3a5f', '#6b7280')}
      </div>
      {renderFooter(defaultFooter, '#f9fafb', '#6b7280', '#e5e7eb')}
    </div>
  );

  // ── Bold ──
  const renderBold = () => (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', maxWidth: '600px', margin: '20px auto', backgroundColor: '#18181b', borderRadius: '4px', overflow: 'hidden' }}>
      <div style={{ padding: logoUrl ? '0' : '24px 28px', borderBottom: `4px solid ${brandColor}`, textAlign: 'center' as const, overflow: 'hidden' }}>
        {logoUrl && <img src={logoUrl} alt="" style={{ width: '100%', maxHeight: '180px', display: 'block', objectFit: 'cover' as const }} />}
        {displayHeaderName && (
          <div style={{ background: logoUrl ? 'rgba(0,0,0,0.5)' : 'transparent', padding: '8px 28px' }}>
            <span style={{ color: '#ffffff', fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em' }}>{displayHeaderName}</span>
          </div>
        )}
      </div>
      <div style={{ padding: '24px 28px' }}>
        {renderBody('#d4d4d8')}
        {renderSignature('#fff', '#a1a1aa', brandColor, '#a1a1aa', { marginTop: '20px', paddingTop: '14px', borderTop: '2px solid #3f3f46' })}
      </div>
      {renderFooter(defaultFooter, '#27272a', '#a1a1aa', '#3f3f46')}
    </div>
  );

  // ── Elegant ──
  const renderElegant = () => (
    <div style={{ fontFamily: 'Georgia, "Times New Roman", serif', maxWidth: '580px', margin: '28px auto', backgroundColor: '#ffffff', border: '1px solid #e8e4df', boxShadow: '0 2px 12px rgba(107,91,79,0.08)' }}>
      <div style={{ borderBottom: '1px solid #e8e4df', padding: logoUrl ? '0' : '28px 32px', textAlign: 'center' as const, overflow: 'hidden' }}>
        {logoUrl && <img src={logoUrl} alt="" style={{ width: '100%', maxHeight: '180px', display: 'block', objectFit: 'cover' as const }} />}
        {displayHeaderName && (
          <div style={{ padding: '8px 32px', background: '#faf9f7' }}>
            <span style={{ fontSize: '22px', fontWeight: 600, color: '#6b5b4f', letterSpacing: '0.04em' }}>{displayHeaderName}</span>
          </div>
        )}
      </div>
      <div style={{ padding: '24px 32px', fontSize: '15px', lineHeight: '1.6' }}>
        {renderBody('#3d3d3d')}
        {renderSignature('#2d2d2d', '#6b5b4f', '#6b5b4f', '#6b7280', { marginTop: '28px', paddingTop: '20px', borderTop: '1px solid #e8e4df' })}
      </div>
      {renderFooter(defaultFooter, '#faf9f7', '#9ca3af', '#e8e4df')}
    </div>
  );

  const previews: Record<EmailTemplatePreviewStyle, () => React.JSX.Element> = {
    professional: renderProfessional,
    minimal: renderMinimal,
    modern: renderModern,
    creative: renderCreative,
    corporate: renderCorporate,
    bold: renderBold,
    elegant: renderElegant,
  };

  const previewContent = (previews[template] || previews.professional)();

  if (bare) {
    return previewContent;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Template Preview
            </CardTitle>
            <CardDescription>
              Preview how your emails will look to recipients
            </CardDescription>
          </div>
          {headerExtra}
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border bg-muted/20 p-4 overflow-auto max-h-[600px]">
          {previewContent}
        </div>
      </CardContent>
    </Card>
  );
}
