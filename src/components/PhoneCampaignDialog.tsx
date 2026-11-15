import { useState, useEffect } from 'react';
import { fillSmsTags, SMS_TAG_HINT } from '@/lib/smsMerge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { Phone, Loader2, Users, Send, CheckCircle, Settings, AlertCircle, X, FlaskConical, Plus, Upload, FolderOpen, Save } from 'lucide-react';
import { parseCSV } from '@/lib/utils/csv-parser';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { PhoneServiceDialog } from '@/components/integrations/PhoneServiceDialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { createRecipientGroupWithMembers } from '@/lib/recipient-group-mutations';
import { Link } from 'react-router-dom';

interface PhoneCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCompanyIds?: string[];
  /** Pre-select phone recipient groups when opening (e.g. from Recipient Groups page). */
  initialGroupIds?: string[];
  /** Open an existing phone campaign (draft or partly sent) for editing. */
  draftCampaignId?: string | null;
}

interface ManualPhoneNumber {
  id: string;
  phone: string;
  name?: string;
  message?: string; // optional per-recipient SMS text (from CSV), overrides the campaign message
}

export function PhoneCampaignDialog({ open, onOpenChange, selectedCompanyIds = [], initialGroupIds = [], draftCampaignId = null }: PhoneCampaignDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [campaignName, setCampaignName] = useState('');
  const [message, setMessage] = useState('');
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set(selectedCompanyIds));
  const [isCreating, setIsCreating] = useState(false);
  const [phoneServiceDialogOpen, setPhoneServiceDialogOpen] = useState(false);
  const [selectedPhoneService, setSelectedPhoneService] = useState<string | null>(null);
  const [manualPhones, setManualPhones] = useState<ManualPhoneNumber[]>([]);
  const [newPhoneNumber, setNewPhoneNumber] = useState('');
  const [newPhoneName, setNewPhoneName] = useState('');
  const [testPhoneNumber, setTestPhoneNumber] = useState('');
  const [isTestingSMS, setIsTestingSMS] = useState(false);
  const [activeTab, setActiveTab] = useState<'companies' | 'manual' | 'groups'>('groups');
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [groupMemberPhones, setGroupMemberPhones] = useState<ManualPhoneNumber[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [saveAsGroupName, setSaveAsGroupName] = useState('');
  const [isSavingGroup, setIsSavingGroup] = useState(false);
  const [savingMode, setSavingMode] = useState<'draft' | 'send' | null>(null);
  // Editing an existing campaign: its id, and phones already texted (kept, never re-sent).
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [alreadyProcessed, setAlreadyProcessed] = useState<{ count: number }>({ count: 0 });
  const [processedKeys, setProcessedKeys] = useState<Set<string>>(new Set());

  const resetForm = () => {
    setCampaignName('');
    setMessage('');
    setSelectedCompanies(new Set());
    setManualPhones([]);
    setGroupMemberPhones([]);
    setSelectedGroupIds(new Set());
    setNewPhoneNumber('');
    setNewPhoneName('');
    setActiveTab('groups');
    setEditingId(null);
    setProcessedKeys(new Set());
    setAlreadyProcessed({ count: 0 });
  };

  // Load an existing phone campaign into the form.
  useEffect(() => {
    if (!open || !draftCampaignId) return;
    let cancelled = false;
    (async () => {
      setLoadingDraft(true);
      try {
        const { data: camp, error } = await supabase
          .from('email_campaigns')
          .select('id, name, body_text_template, tags')
          .eq('id', draftCampaignId)
          .single();
        if (error) throw error;
        const rows: any[] = [];
        for (let page = 0; ; page++) {
          const { data, error: rErr } = await supabase
            .from('email_campaign_recipients')
            .select('email, name, status, personalized_body_text')
            .eq('campaign_id', draftCampaignId)
            .range(page * 1000, page * 1000 + 999);
          if (rErr) throw rErr;
          rows.push(...(data || []));
          if (!data || data.length < 1000) break;
        }
        if (cancelled) return;
        const perRecipientOnly = ((camp.tags as string[] | null) || []).includes('per_recipient_messages');
        const template = perRecipientOnly ? '' : (camp.body_text_template || '');
        const done = new Set<string>();
        const phones: ManualPhoneNumber[] = [];
        for (const r of rows) {
          const phone = String(r.email || '').replace(/^phone:/, '').trim();
          const key = phone.replace(/\D/g, '');
          if (!key) continue;
          if (r.status !== 'pending') { done.add(key); continue; }
          const name = ['Manual Entry', 'Contact', 'Group member'].includes(r.name) ? undefined : r.name || undefined;
          const body = r.personalized_body_text || '';
          // Only keep a per-recipient message if it differs from the campaign message.
          const own = body && body !== fillSmsTags(template, { name, phone }) ? body : undefined;
          phones.push({ id: `draft_${key}`, phone, name, message: own });
        }
        setEditingId(camp.id);
        setCampaignName(String(camp.name || '').replace(/^📞\s*/, ''));
        setMessage(template);
        setManualPhones(phones);
        setSelectedCompanies(new Set());
        setGroupMemberPhones([]);
        setSelectedGroupIds(new Set());
        setProcessedKeys(done);
        setAlreadyProcessed({ count: done.size });
        setActiveTab('manual');
      } catch (e: any) {
        toast({ title: 'Could not open campaign', description: e?.message || 'Failed to load', variant: 'destructive' });
      } finally {
        if (!cancelled) setLoadingDraft(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, draftCampaignId]);

  // Opening a fresh "new campaign" after editing one must not carry the old form over.
  useEffect(() => {
    if (open && !draftCampaignId && editingId) resetForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, draftCampaignId]);

  // Apply preselected groups when dialog opens
  useEffect(() => {
    if (!open) return;
    if (initialGroupIds.length === 0) return;
    setSelectedGroupIds(new Set(initialGroupIds));
    setActiveTab('groups');
    void loadPhonesFromGroups(initialGroupIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialGroupIds.join(',')]);

  // Fetch companies with phone numbers
  const { data: companies } = useQuery({
    queryKey: ['companies-with-phone'],
    queryFn: async () => {
      const { data } = await supabase
        .from('companies')
        .select('id, name, company_phone, general_email')
        .not('company_phone', 'is', null)
        .order('name');
      return data || [];
    },
  });

  // Fetch phone service connections
  const { data: phoneConnections } = useQuery({
    queryKey: ['phone-service-connections'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data } = await supabase
        .from('crm_connections')
        .select('*')
        .eq('user_id', user.id)
        .in('provider', ['twilio', 'vonage', 'messagebird', 'plivo'])
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      return data || [];
    },
  });

  // Recipient groups that have phone members (or phone/mixed channel)
  const { data: phoneGroups = [] } = useQuery({
    queryKey: ['phone-recipient-groups'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      // Prefer channel when available; fall back if migration not applied.
      let groups: { id: string; name: string; description: string | null; channel?: string | null }[] = [];
      const withChannel = await supabase
        .from('recipient_groups')
        .select('id, name, description, channel')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (!withChannel.error && withChannel.data) {
        groups = withChannel.data;
      } else {
        const fallback = await supabase
          .from('recipient_groups')
          .select('id, name, description')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        if (fallback.error) throw fallback.error;
        groups = (fallback.data || []).map((g) => ({ ...g, channel: 'email' }));
      }
      if (!groups.length) return [];
      const ids = groups.map((g) => g.id);
      const withPhone = await supabase
        .from('recipient_group_members')
        .select('group_id, phone')
        .in('group_id', ids)
        .not('phone', 'is', null);
      const counts: Record<string, number> = {};
      if (!withPhone.error) {
        for (const m of withPhone.data || []) {
          if (m.phone) counts[m.group_id] = (counts[m.group_id] || 0) + 1;
        }
      }
      return groups
        .map((g) => ({ ...g, phoneCount: counts[g.id] || 0 }))
        .filter((g) => g.phoneCount > 0 || g.channel === 'phone' || g.channel === 'mixed');
    },
    enabled: open,
  });

  const loadPhonesFromGroups = async (groupIds: string[]) => {
    if (!groupIds.length) {
      setGroupMemberPhones([]);
      return;
    }
    setLoadingGroups(true);
    try {
      const PAGE = 1000;
      const rows: { phone: string | null; email?: string | null; first_name: string | null; last_name: string | null; company: string | null }[] = [];
      for (const gid of groupIds) {
        let page = 0;
        while (true) {
          const { data, error } = await supabase
            .from('recipient_group_members')
            .select('phone, first_name, last_name, company, email')
            .eq('group_id', gid)
            .range(page * PAGE, (page + 1) * PAGE - 1);
          if (error) throw error;
          if (data?.length) rows.push(...(data as any[]));
          if (!data || data.length < PAGE) break;
          page++;
        }
      }
      const seen = new Set<string>();
      const phones: ManualPhoneNumber[] = [];
      for (const r of rows) {
        let phone = (r.phone || '').trim();
        // Back-compat: emails stored as phone:+...
        if (!phone && r.email?.startsWith('phone:')) phone = r.email.slice(6).trim();
        if (!phone) continue;
        const key = phone.replace(/\D/g, '');
        if (key.length < 7 || seen.has(key)) continue;
        seen.add(key);
        const name = [r.first_name, r.last_name].filter(Boolean).join(' ') || r.company || undefined;
        phones.push({ id: `group_${key}`, phone, name });
      }
      setGroupMemberPhones(phones);
    } catch (e: any) {
      toast({ title: 'Could not load group', description: e?.message || 'Failed to load phones', variant: 'destructive' });
    } finally {
      setLoadingGroups(false);
    }
  };

  const toggleGroup = (groupId: string) => {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      void loadPhonesFromGroups([...next]);
      return next;
    });
  };

  const activePhoneServices = phoneConnections || [];
  const activePhoneService = selectedPhoneService 
    ? activePhoneServices.find(s => s.id === selectedPhoneService)
    : activePhoneServices[0];

  const companiesWithPhone = companies?.filter(c => c.company_phone) || [];
  const selectedCompaniesData = companiesWithPhone.filter(c => selectedCompanies.has(c.id));
  
  // Calculate total recipients (companies + manual phones + group phones)
  const totalRecipients = selectedCompanies.size + manualPhones.length + groupMemberPhones.length;
  // Imported rows can carry their own message; the campaign message is only
  // required for recipients that don't (companies, groups, manual numbers).
  const needsCampaignMessage =
    selectedCompanies.size > 0 || groupMemberPhones.length > 0 || manualPhones.some((p) => !p.message);
  const allHaveOwnMessage = manualPhones.length > 0 && !needsCampaignMessage;
  // A real recipient to preview and test with.
  const sampleRecipient: ManualPhoneNumber | undefined = manualPhones[0] || groupMemberPhones[0];
  const testTemplate = message.trim() || sampleRecipient?.message || '';
  const previewText = testTemplate
    ? fillSmsTags(testTemplate, { name: sampleRecipient?.name, phone: sampleRecipient?.phone })
    : '';

  const toggleCompany = (companyId: string) => {
    setSelectedCompanies(prev => {
      const next = new Set(prev);
      if (next.has(companyId)) {
        next.delete(companyId);
      } else {
        next.add(companyId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedCompanies.size === companiesWithPhone.length) {
      setSelectedCompanies(new Set());
    } else {
      setSelectedCompanies(new Set(companiesWithPhone.map(c => c.id)));
    }
  };

  const addManualPhone = () => {
    if (!newPhoneNumber.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a phone number',
        variant: 'destructive',
      });
      return;
    }

    // Basic phone number validation
    const phoneRegex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/;
    if (!phoneRegex.test(newPhoneNumber.trim())) {
      toast({
        title: 'Invalid Phone Number',
        description: 'Please enter a valid phone number (e.g., +1234567890)',
        variant: 'destructive',
      });
      return;
    }

    // Check for duplicates
    if (manualPhones.some(p => p.phone === newPhoneNumber.trim())) {
      toast({
        title: 'Duplicate Phone Number',
        description: 'This phone number is already added',
        variant: 'destructive',
      });
      return;
    }

    setManualPhones(prev => [...prev, {
      id: `manual_${Date.now()}_${Math.random()}`,
      phone: newPhoneNumber.trim(),
      name: newPhoneName.trim() || undefined,
    }]);
    setNewPhoneNumber('');
    setNewPhoneName('');
  };

  const removeManualPhone = (id: string) => {
    setManualPhones(prev => prev.filter(p => p.id !== id));
  };

  // Import a CSV of recipients — auto-detects name / phone / message columns and
  // populates the list ready to send. Message column is optional (per-recipient text).
  const handleCsvImport = async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      const { headers, rows } = parseCSV(text);
      if (headers.length === 0 || rows.length === 0) {
        toast({ title: 'Empty file', description: 'No rows found in that CSV.', variant: 'destructive' });
        return;
      }
      const findCol = (re: RegExp) => headers.findIndex(h => re.test(h.trim()));
      let phoneIdx = findCol(/phone|mobile|tel|number|cell|whatsapp|contact\s*number/i);
      const nameIdx = findCol(/name|contact|company|business|organi[sz]ation|first/i);
      const msgIdx = findCol(/message|text|body|sms|note|content/i);
      // No obvious phone header → pick the column whose values look like phone numbers.
      if (phoneIdx === -1) {
        for (let i = 0; i < headers.length; i++) {
          const sample = rows.find(r => (r[headers[i]] || '').trim())?.[headers[i]] || '';
          if (/[\d][\d\s()+.\-]{6,}/.test(sample) && (sample.replace(/\D/g, '').length >= 7)) { phoneIdx = i; break; }
        }
      }
      if (phoneIdx === -1) {
        toast({ title: 'No phone column found', description: 'Add a header like "phone" or "mobile".', variant: 'destructive' });
        return;
      }
      const existing = new Set(manualPhones.map(p => p.phone));
      const added: ManualPhoneNumber[] = [];
      for (const r of rows) {
        const raw = (r[headers[phoneIdx]] || '').trim();
        const phone = raw.replace(/[^\d+]/g, ''); // keep digits and leading +
        if (!phone || phone.replace(/\D/g, '').length < 7) continue;
        if (existing.has(phone)) continue;
        existing.add(phone);
        added.push({
          id: `csv_${Date.now()}_${added.length}`,
          phone,
          name: nameIdx >= 0 ? ((r[headers[nameIdx]] || '').trim() || undefined) : undefined,
          message: msgIdx >= 0 ? ((r[headers[msgIdx]] || '').trim() || undefined) : undefined,
        });
      }
      if (added.length === 0) {
        toast({ title: 'Nothing imported', description: 'No new valid phone numbers found.', variant: 'destructive' });
        return;
      }
      setManualPhones(prev => [...prev, ...added]);
      setActiveTab('manual');
      const withMsg = added.filter(a => a.message).length;
      toast({ title: `Imported ${added.length} number${added.length === 1 ? '' : 's'}`, description: withMsg ? `${withMsg} include a per-recipient message.` : 'Ready to send.' });
    } catch (e: any) {
      toast({ title: 'Import failed', description: e?.message ?? 'Could not read that CSV.', variant: 'destructive' });
    }
  };

  const handleTestSMS = async () => {
    if (!testPhoneNumber.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a phone number to test',
        variant: 'destructive',
      });
      return;
    }

    if (!testTemplate) {
      toast({
        title: 'Error',
        description: 'Please enter a message to test',
        variant: 'destructive',
      });
      return;
    }

    if (!activePhoneService) {
      toast({
        title: 'Phone Service Required',
        description: 'Please connect a phone service before testing',
        variant: 'destructive',
      });
      setPhoneServiceDialogOpen(true);
      return;
    }

    setIsTestingSMS(true);

    try {
      console.log('Sending test SMS with:', {
        phoneNumber: testPhoneNumber.trim(),
        message: previewText,
        connectionId: activePhoneService.id,
        provider: activePhoneService.provider,
      });

      // Use apiClient which handles auth properly
      const { data, error } = await apiClient.callFunction('send-test-sms', {
        phoneNumber: testPhoneNumber.trim(),
        message: previewText,
        connectionId: activePhoneService.id,
        provider: activePhoneService.provider,
      });

      console.log('Test SMS response:', { data, error });

      if (error) {
        console.error('Supabase function error:', error);
        // The error message should now include details from the function
        const errorMsg = error.message || error.toString() || 'Failed to send test SMS';
        throw new Error(errorMsg);
      }
      
      // Also check if data exists but has an error field
      if (data && !data.success && data.error) {
        const errorMsg = data.details ? `${data.error}: ${data.details}` : data.error;
        throw new Error(errorMsg);
      }

      if (data?.success) {
        toast({
          title: 'Test SMS Sent',
          description: `Test message sent to ${testPhoneNumber}`,
        });
      } else {
        // Show detailed error if available
        const errorMsg = data?.error || 'Failed to send test SMS';
        const details = data?.details ? `\n${data.details}` : '';
        throw new Error(`${errorMsg}${details}`);
      }
    } catch (error: any) {
      console.error('Error sending test SMS:', error);
      const errorMessage = error.message || error.toString() || 'Failed to send test SMS';
      
      // Provide helpful error messages
      let userMessage = errorMessage;
      if (errorMessage.includes('Failed to send a request') || errorMessage.includes('not found') || errorMessage.includes('404')) {
        userMessage = 'Edge function not deployed. Please deploy the send-test-sms function to Supabase.';
      } else if (errorMessage.includes('Unauthorized') || errorMessage.includes('401')) {
        userMessage = 'Authentication failed. Please sign in again.';
      } else if (errorMessage.includes('credentials') || errorMessage.includes('not configured')) {
        userMessage = errorMessage; // Keep the specific credential error
      }
      
      toast({
        title: 'Test Failed',
        description: userMessage,
        variant: 'destructive',
      });
    } finally {
      setIsTestingSMS(false);
    }
  };

  const handleSave = async (mode: 'draft' | 'send') => {
    const name = campaignName.trim() || (mode === 'draft' ? `Phone campaign ${new Date().toLocaleDateString('en-GB')}` : '');
    if (!name) {
      toast({ title: 'Error', description: 'Please enter a campaign name', variant: 'destructive' });
      return;
    }
    if (mode === 'send') {
      if (needsCampaignMessage && !message.trim()) {
        toast({
          title: 'Message needed',
          description: manualPhones.some((p) => p.message)
            ? 'Some recipients have no message of their own. Enter a message to send them.'
            : 'Please enter a message',
          variant: 'destructive',
        });
        return;
      }
      if (totalRecipients === 0) {
        toast({ title: 'Error', description: 'Please add at least one phone number', variant: 'destructive' });
        return;
      }
      if (!activePhoneService) {
        toast({
          title: 'Phone Service Required',
          description: 'Please connect a phone service (Twilio, etc.) before sending',
          variant: 'destructive',
        });
        setPhoneServiceDialogOpen(true);
        return;
      }
    }

    setIsCreating(true);
    setSavingMode(mode);
    let createdId: string | null = null;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const perRecipientOnly = !message.trim() && manualPhones.some((p) => p.message);
      const campaignTemplate = message.trim() || manualPhones.find((p) => p.message)?.message || '';

      // Build recipients, deduped, skipping anyone this campaign already texted.
      const seen = new Set<string>(processedKeys);
      const recipients: any[] = [];
      const pushPhone = (phone: string, rName: string, perMsg?: string) => {
        const key = phone.replace(/\D/g, '');
        if (key.length < 7 || seen.has(key)) return;
        seen.add(key);
        // Fill {name}-style tags now so what's stored is exactly what gets sent.
        const body = fillSmsTags(perMsg || message, { name: rName, phone });
        recipients.push({
          email: `phone:${phone}`,
          name: rName || 'Contact',
          status: 'pending',
          personalized_subject: `Phone Campaign: ${name}`,
          personalized_body_text: body,
          personalized_body_html: `<p>${body.replace(/\n/g, '<br>')}</p>`,
        });
      };
      for (const company of selectedCompaniesData) {
        if (company.company_phone) pushPhone(company.company_phone, company.name);
      }
      for (const phone of manualPhones) pushPhone(phone.phone, phone.name || 'Manual Entry', phone.message);
      for (const phone of groupMemberPhones) pushPhone(phone.phone, phone.name || 'Group member');

      if (mode === 'send' && recipients.length === 0) throw new Error('No valid phone numbers to send to');

      const campaignFields = {
        name: `📞 ${name}`,
        subject_template: `Phone Campaign: ${name}`,
        body_text_template: campaignTemplate,
        body_html_template: `<p>${campaignTemplate.replace(/\n/g, '<br>')}</p>`,
        total_recipients: recipients.length + processedKeys.size,
        tags: perRecipientOnly ? ['phone_sms', 'per_recipient_messages'] : ['phone_sms'],
        ...(activePhoneService ? { sender_connection_id: activePhoneService.id } : {}),
      };

      let campaignId = editingId;
      if (campaignId) {
        const { error } = await supabase.from('email_campaigns').update(campaignFields).eq('id', campaignId);
        if (error) throw error;
        // Replace only the not-yet-sent recipients.
        const { error: delErr } = await supabase
          .from('email_campaign_recipients')
          .delete()
          .eq('campaign_id', campaignId)
          .eq('status', 'pending');
        if (delErr) throw delErr;
      } else {
        const { data: campaign, error } = await supabase
          .from('email_campaigns')
          .insert({ ...campaignFields, user_id: user.id, status: 'draft', sent_count: 0, failed_count: 0, opened_count: 0 })
          .select('id')
          .single();
        if (error) throw error;
        campaignId = campaign.id;
        createdId = campaign.id;
      }

      for (let i = 0; i < recipients.length; i += 500) {
        const chunk = recipients.slice(i, i + 500).map((r) => ({ ...r, campaign_id: campaignId }));
        const { error } = await supabase.from('email_campaign_recipients').insert(chunk);
        if (error) throw error;
      }
      createdId = null; // saved successfully; nothing to roll back

      // UK landlines (01/02/03) cannot receive SMS; say so now rather than at send time.
      const landlines = recipients.filter((r) => {
        const d = String(r.email).replace(/^phone:/, '').trim();
        const digits = d.replace(/\D/g, '');
        return /^0[123]/.test(digits) || /^(\+?44|0044)[123]/.test(d.replace(/[\s()-]/g, ''));
      }).length;
      const landlineNote = landlines > 0 ? ` ${landlines} look like UK landlines, which cannot receive SMS and will be skipped.` : '';

      if (mode === 'send') {
        const { error: sendErr } = await supabase.functions.invoke('send-bulk-sms', { body: { campaignId } });
        if (sendErr) {
          toast({
            title: 'Saved, but sending did not start',
            description: `${sendErr.message || 'Send failed'}. The campaign is saved; start it from Campaigns.`,
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Sending started',
            description: `"${name}" is sending to ${recipients.length} number${recipients.length === 1 ? '' : 's'}. Track progress in Campaigns.${landlineNote}`,
          });
        }
      } else {
        toast({
          title: 'Draft saved',
          description: `"${name}" saved with ${recipients.length} recipient${recipients.length === 1 ? '' : 's'}. Open it from Campaigns to edit or send.${landlineNote}`,
        });
      }

      queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      resetForm();
      onOpenChange(false);
    } catch (error: any) {
      // Don't leave an empty new campaign behind if adding its recipients failed.
      if (createdId) await supabase.from('email_campaigns').delete().eq('id', createdId);
      console.error('Error saving phone campaign:', error);
      toast({ title: 'Error', description: error.message || 'Failed to save phone campaign', variant: 'destructive' });
    } finally {
      setIsCreating(false);
      setSavingMode(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            {editingId ? 'Edit Phone Campaign' : 'Create Phone Campaign'}
          </DialogTitle>
          <DialogDescription>
            {editingId
              ? `Change the message or recipients, then save or send.${alreadyProcessed.count > 0 ? ` ${alreadyProcessed.count} number${alreadyProcessed.count === 1 ? ' was' : 's were'} already sent to and won't be texted again.` : ''}`
              : 'Send an SMS campaign now, or save it as a draft and finish later'}
          </DialogDescription>
          {loadingDraft && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading campaign...
            </div>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Phone Service Connection Status */}
          {!activePhoneService && (
            <Alert className="bg-orange-50 dark:bg-orange-950/30 border-orange-200">
              <AlertCircle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-orange-800 dark:text-orange-200">
                    No Phone Service Connected
                  </p>
                  <p className="text-xs text-orange-700 dark:text-orange-300">
                    Connect a phone service (Twilio, Vonage, etc.) to send SMS campaigns
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPhoneServiceDialogOpen(true)}
                  className="border-orange-300 text-orange-700 hover:bg-orange-100"
                >
                  <Settings className="h-3 w-3 mr-1" />
                  Connect Service
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {activePhoneService && (
            <Alert className="bg-green-50 dark:bg-green-950/30 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-medium text-green-800 dark:text-green-200">
                      Phone Service Connected
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-300">
                      {activePhoneServices.length > 1 
                        ? `${activePhoneServices.length} services available`
                        : `Using ${activePhoneService.provider} for SMS delivery`
                      }
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPhoneServiceDialogOpen(true)}
                    className="text-green-700 hover:bg-green-100"
                  >
                    <Settings className="h-3 w-3 mr-1" />
                    Manage
                  </Button>
                </div>
                {activePhoneServices.length > 1 && (
                  <Select
                    value={selectedPhoneService || activePhoneService.id}
                    onValueChange={setSelectedPhoneService}
                  >
                    <SelectTrigger className="w-full mt-2">
                      <SelectValue placeholder="Select phone service" />
                    </SelectTrigger>
                    <SelectContent>
                      {activePhoneServices.map((service) => (
                        <SelectItem key={service.id} value={service.id}>
                          <div className="flex items-center gap-2">
                            <Phone className="h-3 w-3" />
                            <span className="capitalize">{service.provider}</span>
                            {service.id === activePhoneService.id && (
                              <Badge variant="outline" className="ml-2 text-xs">
                                Default
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="campaign-name">Campaign Name</Label>
            <Input
              id="campaign-name"
              placeholder="e.g., Q1 Outreach Campaign"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              disabled={isCreating}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">
              Message{allHaveOwnMessage && <span className="font-normal text-muted-foreground"> (optional: your imported rows have their own messages)</span>}
            </Label>
            <Textarea
              id="message"
              placeholder={allHaveOwnMessage ? 'Leave empty to send each imported message as written' : 'e.g. Hi {first_name}, ...'}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[120px]"
              disabled={isCreating}
            />
            <p className="text-xs text-muted-foreground">
              {message.length} characters (SMS limit: 160 characters) · {SMS_TAG_HINT}
            </p>
            {previewText && sampleRecipient && previewText !== testTemplate && (
              <p className="text-xs rounded-md border bg-muted/40 p-2">
                <span className="font-medium">Preview for {sampleRecipient.name || sampleRecipient.phone}:</span> {previewText}
              </p>
            )}
          </div>

          {/* Test SMS Section */}
          {activePhoneService && (
            <div className="space-y-2 p-4 border rounded-lg bg-muted/30">
              <div className="flex items-center gap-2 mb-2">
                <FlaskConical className="h-4 w-4 text-primary" />
                <Label className="font-semibold">Test SMS Before Sending</Label>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter phone number (e.g., +1234567890)"
                  value={testPhoneNumber}
                  onChange={(e) => setTestPhoneNumber(e.target.value)}
                  disabled={isTestingSMS || isCreating}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  onClick={handleTestSMS}
                  disabled={isTestingSMS || isCreating || !testPhoneNumber.trim() || !testTemplate}
                >
                  {isTestingSMS ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <FlaskConical className="h-4 w-4 mr-2" />
                      Send Test
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Send a test message to verify your phone service is working correctly
              </p>
            </div>
          )}

          {/* Recipients Selection Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'companies' | 'manual' | 'groups')}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="groups">
                <FolderOpen className="h-4 w-4 mr-2" />
                Groups ({groupMemberPhones.length})
              </TabsTrigger>
              <TabsTrigger value="companies">
                <Users className="h-4 w-4 mr-2" />
                Companies ({selectedCompanies.size})
              </TabsTrigger>
              <TabsTrigger value="manual">
                <Phone className="h-4 w-4 mr-2" />
                Manual ({manualPhones.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="groups" className="space-y-3 mt-4">
              <div className="flex items-center justify-between gap-2">
                <Label>Add from phone recipient groups</Label>
                <Button variant="link" size="sm" className="h-auto p-0" asChild>
                  <Link to="/recipient-groups">Manage groups</Link>
                </Button>
              </div>
              {loadingGroups && (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading members…
                </p>
              )}
              <ScrollArea className="h-[240px] border rounded-md p-3">
                <div className="space-y-2">
                  {(phoneGroups || []).length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No phone groups yet. Create one under Recipient Groups → paste/import phones, or save numbers from this dialog.
                    </p>
                  )}
                  {(phoneGroups || []).map((g: any) => (
                    <label key={g.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted cursor-pointer">
                      <Checkbox
                        checked={selectedGroupIds.has(g.id)}
                        onCheckedChange={() => toggleGroup(g.id)}
                        disabled={isCreating}
                      />
                      <span className="flex-1 truncate">{g.name}</span>
                      <Badge variant="secondary">{g.phoneCount} phones</Badge>
                    </label>
                  ))}
                </div>
              </ScrollArea>
              {groupMemberPhones.length > 0 && (
                <p className="text-xs text-muted-foreground">{groupMemberPhones.length} unique phone numbers from selected groups.</p>
              )}

              <div className="rounded-lg border p-3 space-y-2 bg-muted/20">
                <Label className="text-sm">Save current manual numbers as a phone group</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Group name e.g. Hospitality UK phones"
                    value={saveAsGroupName}
                    onChange={(e) => setSaveAsGroupName(e.target.value)}
                    disabled={isSavingGroup || manualPhones.length === 0}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isSavingGroup || !saveAsGroupName.trim() || manualPhones.length === 0}
                    onClick={async () => {
                      setIsSavingGroup(true);
                      try {
                        const { data: { user } } = await supabase.auth.getUser();
                        if (!user) throw new Error('Sign in required');
                        const { groupId, count } = await createRecipientGroupWithMembers(supabase, {
                          userId: user.id,
                          name: saveAsGroupName.trim(),
                          description: 'Phone/SMS recipient group',
                          channel: 'phone',
                          members: manualPhones.map((p) => ({
                            email: null,
                            phone: p.phone,
                            first_name: p.name || null,
                            last_name: null,
                            company: null,
                            person_id: null,
                          })),
                        });
                        queryClient.invalidateQueries({ queryKey: ['phone-recipient-groups'] });
                        queryClient.invalidateQueries({ queryKey: ['recipient-groups'] });
                        queryClient.invalidateQueries({ queryKey: ['recipient-groups-page'] });
                        setSelectedGroupIds((prev) => new Set([...prev, groupId]));
                        await loadPhonesFromGroups([...selectedGroupIds, groupId]);
                        setSaveAsGroupName('');
                        toast({ title: 'Phone group saved', description: `${count} numbers in "${saveAsGroupName.trim()}".` });
                      } catch (e: any) {
                        toast({ title: 'Save failed', description: e?.message || 'Could not save group', variant: 'destructive' });
                      } finally {
                        setIsSavingGroup(false);
                      }
                    }}
                  >
                    {isSavingGroup ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Uses numbers from the Manual tab ({manualPhones.length}).</p>
              </div>
            </TabsContent>

            <TabsContent value="companies" className="space-y-2 mt-4">
              <div className="flex items-center justify-between">
                <Label>Select Companies ({selectedCompanies.size} selected)</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleSelectAll}
                  disabled={isCreating}
                >
                  {selectedCompanies.size === companiesWithPhone.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
              <ScrollArea className="h-[300px] border rounded-md p-4">
                <div className="space-y-2">
                  {companiesWithPhone.map((company) => (
                    <div
                      key={company.id}
                      className="flex items-center gap-3 p-2 rounded-lg border hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={selectedCompanies.has(company.id)}
                        onCheckedChange={() => toggleCompany(company.id)}
                        disabled={isCreating}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{company.name}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <Phone className="h-3 w-3" />
                          {company.company_phone}
                          {company.general_email && (
                            <>
                              <span>•</span>
                              <span>📧 {company.general_email}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {companiesWithPhone.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No companies with phone numbers found
                    </p>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="manual" className="space-y-2 mt-4">
              {/* CSV import */}
              <div className="rounded-lg border border-dashed p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-muted/20">
                <div className="text-sm">
                  <div className="font-medium flex items-center gap-1.5"><Upload className="h-4 w-4" /> Import from CSV</div>
                  <div className="text-xs text-muted-foreground">Columns auto-detected: <strong>name</strong>, <strong>phone</strong>, and optional <strong>message</strong> (per-recipient text).</div>
                </div>
                <Button variant="outline" size="sm" asChild disabled={isCreating}>
                  <label className="cursor-pointer">
                    <Upload className="h-4 w-4 mr-2" /> Choose CSV
                    <input
                      type="file"
                      accept=".csv,text/csv,text/plain"
                      className="hidden"
                      onChange={(e) => { handleCsvImport(e.target.files?.[0] || null); e.currentTarget.value = ''; }}
                    />
                  </label>
                </Button>
              </div>

              <Label className="pt-2 block">Or add phone numbers manually</Label>
              <div className="flex gap-2">
                <div className="flex-1 space-y-2">
                  <Input
                    placeholder="Phone number (e.g., +1234567890)"
                    value={newPhoneNumber}
                    onChange={(e) => setNewPhoneNumber(e.target.value)}
                    disabled={isCreating}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addManualPhone();
                      }
                    }}
                  />
                  <Input
                    placeholder="Name (optional)"
                    value={newPhoneName}
                    onChange={(e) => setNewPhoneName(e.target.value)}
                    disabled={isCreating}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addManualPhone();
                      }
                    }}
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={addManualPhone}
                  disabled={isCreating || !newPhoneNumber.trim()}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add
                </Button>
              </div>

              {manualPhones.length > 0 && (
                <ScrollArea className="h-[250px] border rounded-md p-4 mt-4">
                  <div className="space-y-2">
                    {manualPhones.map((phone) => (
                      <div
                        key={phone.id}
                        className="flex items-center gap-3 p-2 rounded-lg border hover:bg-muted/50"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{phone.name || 'Unnamed'}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2">
                            <Phone className="h-3 w-3" />
                            {phone.phone}
                          </div>
                          {phone.message && (
                            <div className="text-xs text-muted-foreground/80 mt-1 truncate italic" title={phone.message}>
                              “{phone.message}”
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeManualPhone(phone.id)}
                          disabled={isCreating}
                          className="text-destructive hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <div className="flex flex-col gap-3 pt-4 border-t sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            {totalRecipients} recipient{totalRecipients !== 1 ? 's' : ''}
            {(selectedCompanies.size > 0 || manualPhones.length > 0 || groupMemberPhones.length > 0) && (
              <>
                {' '}(
                {[
                  selectedCompanies.size > 0 ? `${selectedCompanies.size} companies` : null,
                  manualPhones.length > 0 ? `${manualPhones.length} ${editingId ? 'to send' : 'manual'}` : null,
                  groupMemberPhones.length > 0 ? `${groupMemberPhones.length} from groups` : null,
                ]
                  .filter(Boolean)
                  .join(', ')}
                )
              </>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button
              variant="ghost"
              className="col-span-2 sm:col-span-1"
              onClick={() => onOpenChange(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => handleSave('draft')}
              disabled={isCreating || loadingDraft}
            >
              {savingMode === 'draft' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save draft
            </Button>
            <Button
              onClick={() => handleSave('send')}
              disabled={isCreating || loadingDraft || totalRecipients === 0}
            >
              {savingMode === 'send' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Send now
            </Button>
          </div>
        </div>

        <PhoneServiceDialog
          open={phoneServiceDialogOpen}
          onOpenChange={setPhoneServiceDialogOpen}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['phone-service-connections'] });
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
