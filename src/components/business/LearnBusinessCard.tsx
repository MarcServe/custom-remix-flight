import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Globe, Loader2, Sparkles, Check, ChevronDown, ChevronUp } from 'lucide-react';

export interface LearnedProfile {
  company_name?: string | null; industry?: string | null; services_description?: string | null; target_audience?: string | null;
  value_proposition?: string | null; tone_preference?: string | null; website?: string | null; phone?: string | null;
  email_signature?: string | null; email_brand_color?: string | null; email_logo_url?: string | null; knowledge_base?: string | null;
}
interface Extras { locations?: string | null; offerings?: { name: string; summary: string; price?: string | null }[]; proof_points?: string[]; faqs?: { q: string; a: string }[]; pages_read?: string[] }

const LABELS: Record<string, string> = {
  company_name: 'Company name', industry: 'Industry', services_description: 'What you do', target_audience: 'Who it’s for',
  value_proposition: 'Why you', tone_preference: 'Tone', website: 'Website', phone: 'Phone', email_signature: 'Email signature',
  email_brand_color: 'Brand colour', email_logo_url: 'Logo', knowledge_base: 'Knowledge base',
};

export function LearnBusinessCard({ initialUrl, onApply }: { initialUrl?: string; onApply: (p: LearnedProfile) => void }) {
  const { toast } = useToast();
  const [url, setUrl] = useState(initialUrl || '');
  const [text, setText] = useState('');
  const [showText, setShowText] = useState(false);
  const [loading, setLoading] = useState(false);
  const [proposal, setProposal] = useState<LearnedProfile | null>(null);
  const [extras, setExtras] = useState<Extras | null>(null);
  const [picked, setPicked] = useState<Record<string, boolean>>({});

  const learn = async () => {
    if (!url.trim() && !text.trim()) { toast({ title: 'Enter your website address', variant: 'destructive' }); return; }
    setLoading(true); setProposal(null);
    try {
      const { data, error } = await supabase.functions.invoke('learn-business', { body: { url: url.trim() || undefined, text: text.trim() || undefined, apply: false } });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setProposal(data.proposal); setExtras(data.extras);
      const all: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(data.proposal || {})) if (v) all[k] = true;
      setPicked(all);
    } catch (e: any) {
      toast({ title: 'Could not learn from that site', description: e?.message || 'Try again or paste a description.', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const apply = () => {
    if (!proposal) return;
    const out: LearnedProfile = {};
    for (const [k, v] of Object.entries(proposal)) if (picked[k] && v) (out as any)[k] = v;
    onApply(out);
    toast({ title: 'Filled in from your website', description: 'Review the fields below, then click Save Profile.' });
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2"><Globe className="h-5 w-5 text-primary" /></div>
        <div className="flex-1">
          <h2 className="font-semibold">Learn from my website</h2>
          <p className="text-sm text-muted-foreground">Paste your site address. LeadBoosters reads it and fills in your profile plus a knowledge base of facts, so every AI-written email, text, newsletter and automation is about <em>your</em> business.</p>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <Input id="learn-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="www.yourbusiness.co.uk" className="flex-1" onKeyDown={(e) => { if (e.key === 'Enter') learn(); }} />
        <Button onClick={learn} disabled={loading} className="gap-2">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {loading ? 'Reading your site…' : 'Learn my business'}</Button>
      </div>
      <button type="button" onClick={() => setShowText((v) => !v)} className="text-xs text-muted-foreground underline flex items-center gap-1">
        {showText ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />} No website, or it says little? Paste a description instead
      </button>
      {showText && <Textarea id="learn-text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Describe the business: what you offer, prices, who it's for, where you operate, what makes you different…" className="min-h-[100px]" />}

      {proposal && (
        <div className="space-y-3 border-t pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-medium">Here's what I found{extras?.pages_read?.length ? <span className="text-muted-foreground font-normal"> ({extras.pages_read.length} page{extras.pages_read.length === 1 ? '' : 's'} read)</span> : null}</div>
            <Button size="sm" onClick={apply} className="gap-1"><Check className="h-4 w-4" /> Use selected</Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries(proposal).filter(([, v]) => v).map(([k, v]) => (
              <label key={k} className={`flex gap-2 rounded-md border p-2 text-sm cursor-pointer ${picked[k] ? 'border-primary/50 bg-primary/5' : 'opacity-70'} ${k === 'knowledge_base' ? 'sm:col-span-2' : ''}`}>
                <input type="checkbox" className="mt-1" checked={!!picked[k]} onChange={(e) => setPicked({ ...picked, [k]: e.target.checked })} />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-muted-foreground">{LABELS[k] || k}</div>
                  {k === 'email_logo_url' ? <img src={String(v)} alt="Logo found on site" className="mt-1 h-10 w-auto rounded bg-white object-contain" />
                    : k === 'email_brand_color' ? <span className="inline-flex items-center gap-2"><span className="inline-block h-4 w-4 rounded border" style={{ background: String(v) }} />{String(v)}</span>
                    : <div className={`whitespace-pre-wrap break-words ${k === 'knowledge_base' ? 'max-h-48 overflow-auto text-xs' : ''}`}>{String(v)}</div>}
                </div>
              </label>
            ))}
          </div>
          {(extras?.offerings?.length || extras?.proof_points?.length) ? (
            <div className="text-xs text-muted-foreground flex flex-wrap gap-1">
              {extras?.offerings?.slice(0, 8).map((o) => <Badge key={o.name} variant="secondary">{o.name}{o.price ? ` · ${o.price}` : ''}</Badge>)}
              {extras?.proof_points?.slice(0, 4).map((p) => <Badge key={p} variant="outline">{p}</Badge>)}
            </div>
          ) : null}
        </div>
      )}
    </Card>
  );
}
