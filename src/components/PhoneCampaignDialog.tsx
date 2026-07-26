import { useState } from 'react';
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
import { Phone, Loader2, Users, Send, CheckCircle, Settings, AlertCircle, X, FlaskConical, Plus, Upload } from 'lucide-react';
import { parseCSV } from '@/lib/utils/csv-parser';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { PhoneServiceDialog } from '@/components/integrations/PhoneServiceDialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface PhoneCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCompanyIds?: string[];
}

interface ManualPhoneNumber {
  id: string;
  phone: string;
  name?: string;
  message?: string; // optional per-recipient SMS text (from CSV), overrides the campaign message
}

export function PhoneCampaignDialog({ open, onOpenChange, selectedCompanyIds = [] }: PhoneCampaignDialogProps) {
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
  const [activeTab, setActiveTab] = useState<'companies' | 'manual'>('companies');

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

  const activePhoneServices = phoneConnections || [];
  const activePhoneService = selectedPhoneService 
    ? activePhoneServices.find(s => s.id === selectedPhoneService)
    : activePhoneServices[0];

  const companiesWithPhone = companies?.filter(c => c.company_phone) || [];
  const selectedCompaniesData = companiesWithPhone.filter(c => selectedCompanies.has(c.id));
  
  // Calculate total recipients (companies + manual phones)
  const totalRecipients = selectedCompanies.size + manualPhones.length;

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

    if (!message.trim()) {
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
        message: message.trim(),
        connectionId: activePhoneService.id,
        provider: activePhoneService.provider,
      });

      // Use apiClient which handles auth properly
      const { data, error } = await apiClient.callFunction('send-test-sms', {
        phoneNumber: testPhoneNumber.trim(),
        message: message.trim(),
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

  const handleCreateCampaign = async () => {
    if (!campaignName.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a campaign name',
        variant: 'destructive',
      });
      return;
    }

    if (!message.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a message',
        variant: 'destructive',
      });
      return;
    }

    if (totalRecipients === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one company or add a manual phone number',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Check if phone service is connected
      if (!activePhoneService) {
        toast({
          title: 'Phone Service Required',
          description: 'Please connect a phone service (Twilio, etc.) before creating a campaign',
          variant: 'destructive',
        });
        setPhoneServiceDialogOpen(true);
        setIsCreating(false);
        return;
      }

      // Create phone campaign using email_campaigns structure
      // Store phone message in body_text_template and mark in subject
      const { data: campaign, error: campaignError } = await supabase
        .from('email_campaigns')
        .insert({
          user_id: user.id,
          name: `📞 ${campaignName}`, // Prefix with phone emoji to identify
          subject_template: `Phone Campaign: ${campaignName}`,
          body_text_template: message,
          body_html_template: `<p>${message.replace(/\n/g, '<br>')}</p>`,
          status: 'draft',
          total_recipients: totalRecipients,
          sent_count: 0,
          failed_count: 0,
          opened_count: 0,
          sender_connection_id: activePhoneService.id, // Link to phone service
        })
        .select('id')
        .single();

      if (campaignError) throw campaignError;

      // Prepare recipients from companies and manual phones
      // NOTE: email_campaign_recipients has no company_id column — including it
      // makes the insert fail ("Could not find the 'company_id' column…").
      const recipients = [
        ...selectedCompaniesData.map(company => ({
          campaign_id: campaign.id,
          email: `phone:${company.company_phone}`, // Store phone in email field with prefix
          name: company.name,
          status: 'pending' as const,
        })),
        ...manualPhones.map(phone => ({
          campaign_id: campaign.id,
          email: `phone:${phone.phone}`,
          name: phone.name || 'Manual Entry',
          status: 'pending' as const,
          // Per-recipient SMS text where the CSV provided one (falls back to the campaign message at send).
          ...(phone.message ? { personalized_body_text: phone.message } : {}),
        })),
      ];

      // Store phone recipients - use email field to store phone number with prefix
      const { error: recipientsError } = await supabase
        .from('email_campaign_recipients')
        .insert(recipients as any);

      if (recipientsError) throw recipientsError;

      queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });
      
      toast({
        title: 'Success',
        description: `Phone campaign "${campaignName}" created with ${totalRecipients} recipients`,
      });

      // Reset form
      setCampaignName('');
      setMessage('');
      setSelectedCompanies(new Set());
      setManualPhones([]);
      setNewPhoneNumber('');
      setNewPhoneName('');
      setActiveTab('companies');
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error creating phone campaign:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create phone campaign',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Create Phone Campaign
          </DialogTitle>
          <DialogDescription>
            Create a phone/SMS campaign for companies with phone numbers
          </DialogDescription>
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
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              placeholder="Enter your SMS/phone message here..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[120px]"
              disabled={isCreating}
            />
            <p className="text-xs text-muted-foreground">
              {message.length} characters (SMS limit: 160 characters)
            </p>
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
                  disabled={isTestingSMS || isCreating || !testPhoneNumber.trim() || !message.trim()}
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
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'companies' | 'manual')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="companies">
                <Users className="h-4 w-4 mr-2" />
                Companies ({selectedCompanies.size})
              </TabsTrigger>
              <TabsTrigger value="manual">
                <Phone className="h-4 w-4 mr-2" />
                Manual Entry ({manualPhones.length})
              </TabsTrigger>
            </TabsList>

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

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {totalRecipients} recipient{totalRecipients !== 1 ? 's' : ''} total
            {selectedCompanies.size > 0 && ` (${selectedCompanies.size} companies`}
            {selectedCompanies.size > 0 && manualPhones.length > 0 && ', '}
            {manualPhones.length > 0 && `${manualPhones.length} manual`}
            {selectedCompanies.size > 0 && ')'}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateCampaign}
              disabled={isCreating || totalRecipients === 0}
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Create Campaign
                </>
              )}
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
