import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mail } from 'lucide-react';

interface EmailTemplatePreviewProps {
  template: 'professional' | 'minimal' | 'modern';
  brandColor: string;
  logoUrl?: string;
  companyName?: string;
  senderName?: string;
  senderTitle?: string;
  senderEmail?: string;
  footerText?: string;
}

export function EmailTemplatePreview({
  template,
  brandColor,
  logoUrl,
  companyName = 'Your Company',
  senderName = 'John Doe',
  senderTitle = 'Sales Representative',
  senderEmail = 'john@company.com',
  footerText,
}: EmailTemplatePreviewProps) {
  const sampleBody = `Hi [Name],

Thank you for your interest! I wanted to follow up on our previous conversation about how we can help your business grow.

We specialize in providing innovative solutions that have helped companies like yours achieve remarkable results. I'd love to schedule a quick call to discuss your specific needs.

Would you be available for a 15-minute call this week?

Looking forward to connecting!`;

  const renderProfessionalPreview = () => (
    <div style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      maxWidth: '600px',
      margin: '0 auto',
      backgroundColor: '#ffffff',
      borderRadius: '8px',
      overflow: 'hidden',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    }}>
      <div style={{
        background: `linear-gradient(135deg, ${brandColor} 0%, ${brandColor}dd 100%)`,
        padding: '30px 40px',
        textAlign: 'center',
      }}>
        {logoUrl ? (
          <img src={logoUrl} alt="Logo" style={{ maxWidth: '180px', maxHeight: '60px', marginBottom: '10px' }} />
        ) : (
          <h1 style={{ color: '#ffffff', margin: 0, fontSize: '24px', fontWeight: 600 }}>{companyName}</h1>
        )}
      </div>
      <div style={{ padding: '40px' }}>
        <div style={{ marginBottom: '30px', fontSize: '15px', lineHeight: '1.8' }}>
          {sampleBody.split('\n').map((line, i) => (
            <div key={i} style={{ marginBottom: line === '' ? '16px' : '0' }}>
              {line || <br />}
            </div>
          ))}
        </div>
        <div style={{
          marginTop: '30px',
          paddingTop: '20px',
          borderTop: `2px solid #e5e7eb`,
        }}>
          <div style={{ fontWeight: 600, fontSize: '16px', color: '#111827', marginBottom: '4px' }}>
            {senderName}
          </div>
          <div style={{ color: '#6b7280', fontSize: '14px', marginBottom: '2px' }}>
            {senderTitle}
          </div>
          <div style={{ color: brandColor, fontWeight: 600, fontSize: '14px', marginBottom: '8px' }}>
            {companyName}
          </div>
          <div style={{ color: '#6b7280', fontSize: '13px' }}>
            {senderEmail}
          </div>
        </div>
      </div>
      <div style={{
        backgroundColor: '#f9fafb',
        padding: '20px 40px',
        textAlign: 'center',
        color: '#6b7280',
        fontSize: '13px',
        borderTop: '1px solid #e5e7eb',
      }}>
        {footerText || `© ${new Date().getFullYear()} ${companyName}. All rights reserved.`}
      </div>
    </div>
  );

  const renderMinimalPreview = () => (
    <div style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      maxWidth: '600px',
      margin: '0 auto',
      padding: '20px',
    }}>
      {(logoUrl || companyName) && (
        <div style={{ paddingBottom: '20px', borderBottom: '1px solid #e5e7eb', marginBottom: '30px' }}>
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" style={{ maxWidth: '120px', maxHeight: '40px' }} />
          ) : (
            <span>{companyName}</span>
          )}
        </div>
      )}
      <div style={{ fontSize: '15px', lineHeight: '1.7', color: '#374151' }}>
        {sampleBody.split('\n').map((line, i) => (
          <div key={i} style={{ marginBottom: line === '' ? '16px' : '0' }}>
            {line || <br />}
          </div>
        ))}
      </div>
      <div style={{
        marginTop: '40px',
        paddingTop: '20px',
        borderTop: '1px solid #e5e7eb',
        fontSize: '14px',
        color: '#6b7280',
      }}>
        <div style={{ fontWeight: 600, color: '#111827', marginBottom: '4px' }}>{senderName}</div>
        {senderTitle && <div>{senderTitle}</div>}
        {companyName && <div>{companyName}</div>}
        <div>{senderEmail}</div>
      </div>
      {footerText && (
        <div style={{
          marginTop: '40px',
          paddingTop: '20px',
          borderTop: '1px solid #e5e7eb',
          textAlign: 'center',
          fontSize: '12px',
          color: '#9ca3af',
        }}>
          {footerText}
        </div>
      )}
    </div>
  );

  const renderModernPreview = () => (
    <div style={{
      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
      maxWidth: '640px',
      margin: '40px auto',
      backgroundColor: '#ffffff',
      borderRadius: '16px',
      overflow: 'hidden',
      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
    }}>
      <div style={{
        background: `linear-gradient(135deg, ${brandColor}20 0%, ${brandColor}10 100%)`,
        padding: '40px',
        position: 'relative',
        borderTop: `4px solid ${brandColor}`,
      }}>
        {logoUrl ? (
          <img src={logoUrl} alt="Logo" style={{ maxWidth: '160px', maxHeight: '50px' }} />
        ) : (
          <h2 style={{ margin: 0, color: brandColor, fontSize: '24px' }}>{companyName}</h2>
        )}
      </div>
      <div style={{ padding: '40px' }}>
        <div style={{ fontSize: '15px', lineHeight: '1.8', color: '#334155', marginBottom: '32px' }}>
          {sampleBody.split('\n').map((line, i) => (
            <div key={i} style={{ marginBottom: line === '' ? '16px' : '0' }}>
              {line || <br />}
            </div>
          ))}
        </div>
        <div style={{
          background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
          padding: '24px',
          borderRadius: '12px',
          borderLeft: `4px solid ${brandColor}`,
        }}>
          <div style={{ fontWeight: 700, fontSize: '17px', color: '#0f172a', marginBottom: '4px' }}>
            {senderName}
          </div>
          <div style={{ color: '#64748b', fontSize: '14px', fontWeight: 500, marginBottom: '2px' }}>
            {senderTitle}
          </div>
          <div style={{ color: brandColor, fontWeight: 600, fontSize: '15px', marginBottom: '8px' }}>
            {companyName}
          </div>
          <div style={{ color: '#64748b', fontSize: '13px' }}>
            {senderEmail}
          </div>
        </div>
      </div>
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        padding: '24px 40px',
        textAlign: 'center',
        color: '#94a3b8',
        fontSize: '13px',
      }}>
        {footerText || `© ${new Date().getFullYear()} ${companyName}. All rights reserved.`}
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Email Template Preview
        </CardTitle>
        <CardDescription>
          Preview how your emails will look to recipients
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border bg-muted/20 p-4 overflow-auto max-h-[600px]">
          {template === 'professional' && renderProfessionalPreview()}
          {template === 'minimal' && renderMinimalPreview()}
          {template === 'modern' && renderModernPreview()}
        </div>
      </CardContent>
    </Card>
  );
}