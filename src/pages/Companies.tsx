import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Building2, MapPin, Users2, Mail, Eye, Briefcase, Globe, Phone, Upload, Filter, X, Trash2, Loader2, Sparkles, UserPlus, CheckCircle2, Wand2, Search, Plus, RefreshCw, CalendarDays, Send, Megaphone, FolderPlus } from "lucide-react";
import { CompanyDetailsDialog } from "@/components/CompanyDetailsDialog";
import { SendEmailDialog } from "@/components/SendEmailDialog";
import { CampaignGroupingDialog, type CompanyForGrouping } from "@/components/CampaignGroupingDialog";
import { AddContactDialog } from "@/components/AddContactDialog";
import { ProspectAnalyzer, TemperatureBadge } from "@/components/ProspectAnalyzer";
import { ApifyCSVUploader } from "@/components/ApifyCSVUploader";
import { ApifyScraperDialog } from "@/components/ApifyScraperDialog";
import { CampaignFitAnalyzer } from "@/components/CampaignFitAnalyzer";
import { TagBadges, TagInput } from "@/components/ui/tag-input";
import { useCompanyTags } from "@/hooks/use-company-tags";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useCampaignDialog } from "@/contexts/CampaignDialogContext";
import type { Company } from "@/lib/api/companies";
import { getCompanySource, SOURCE_TAG_LIST } from "@/lib/company-sources";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TimePicker } from "@/components/ui/time-picker";
import { Calendar } from "@/components/ui/calendar";

/** Virtual tag category for filtering companies that have no tags (and no suggestedTags from enrichment) */
const UNTAGGED_CATEGORY = "No tags";

export default function Companies() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { openWithPeople, addPeople, open: bulkEmailDialogOpen } = useCampaignDialog();
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [csvUploaderOpen, setCsvUploaderOpen] = useState(false);
  const [scraperDialogOpen, setScraperDialogOpen] = useState(false);
  const [selectedTagFilters, setSelectedTagFilters] = useState<string[]>([]);
  const [emailStatusFilter, setEmailStatusFilter] = useState<'all' | 'has-email' | 'has-email-and-phone' | 'has-email-not-in-contacts' | 'in-contacts' | 'no-email'>('all');
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [groupingDialogOpen, setGroupingDialogOpen] = useState(false);
  const [groupingDialogCompanies, setGroupingDialogCompanies] = useState<CompanyForGrouping[]>([]);
  const [createGroupDialogOpen, setCreateGroupDialogOpen] = useState(false);
  const [createGroupName, setCreateGroupName] = useState("");
  const [createGroupDescription, setCreateGroupDescription] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [groupBySource, setGroupBySource] = useState(true);
  const [dateAddedPreset, setDateAddedPreset] = useState<'all' | 'today' | 'yesterday' | 'last7' | 'last30' | 'last90' | 'custom'>('all');
  const [dateAddedFrom, setDateAddedFrom] = useState<string>('');
  const [dateAddedTo, setDateAddedTo] = useState<string>('');
  const [dateAddedFromTime, setDateAddedFromTime] = useState<string>('');
  const [dateAddedToTime, setDateAddedToTime] = useState<string>('');
  const [sentInFilter, setSentInFilter] = useState<'all' | 'sent-campaign' | 'sent-newsletter' | 'not-sent'>('all');
  const [selectedCampaignTagFilters, setSelectedCampaignTagFilters] = useState<string[]>([]);
  const [companiesPage, setCompaniesPage] = useState(1);
  const [companiesPageSize, setCompaniesPageSize] = useState(50);
  const [emailRecipient, setEmailRecipient] = useState<{
    email: string;
    name: string;
    companyId?: string;
    contactId?: string;
  } | null>(null);
  const [addContactDialogOpen, setAddContactDialogOpen] = useState(false);
  const [companyForContact, setCompanyForContact] = useState<Company | null>(null);
  const [contactInitialValues, setContactInitialValues] = useState<{
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    title?: string;
    company_id?: string | null;
    company_name?: string;
    linkedin_url?: string;
  } | undefined>(undefined);

  const { existingTags, allSuggestions, updateCompanyTags } = useCompanyTags();
  const [showTagMigrationPrompt, setShowTagMigrationPrompt] = useState(false);
  
  // Mutation to migrate tags from enrichment_data.suggestedTags to tags column
  const migrateTagsMutation = useMutation({
    mutationFn: async () => {
      if (!companies) return { migrated: 0, total: 0 };
      
      let migrated = 0;
      const updates: Array<{ id: string; tags: string[] }> = [];
      
      for (const company of companies) {
        const enrichmentData = company.enrichment_data as any;
        const suggestedTags = enrichmentData?.suggestedTags || [];
        
        if (Array.isArray(suggestedTags) && suggestedTags.length > 0) {
          const currentTags = company.tags || [];
          const newTags = Array.from(new Set([...currentTags, ...suggestedTags.map((t: string) => t.trim())]));
          
          if (newTags.length > currentTags.length) {
            updates.push({ id: company.id, tags: newTags });
          }
        }
      }
      
      // Batch update companies
      for (const update of updates) {
        const { error } = await supabase
          .from('companies')
          .update({ tags: update.tags })
          .eq('id', update.id);
        
        if (!error) {
          migrated++;
        }
      }
      
      return { migrated, total: updates.length };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['companies-full'] });
      queryClient.invalidateQueries({ queryKey: ['companies-total-count'] });
      queryClient.invalidateQueries({ queryKey: ['company-existing-tags'] });
      toast({
        title: 'Tags Migrated',
        description: `Applied tags to ${result.migrated} companies from enrichment data`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to migrate tags',
        variant: 'destructive',
      });
    },
  });

  // Fetch people emails to check if companies are already in contacts
  const { data: peopleEmails } = useQuery({
    queryKey: ["people-emails"],
    queryFn: async () => {
      const { data } = await supabase
        .from("people")
        .select("email");
      return new Set((data || []).map(p => p.email?.toLowerCase()).filter(Boolean));
    },
  });

  // Emails that have been sent in a campaign (with campaign tags for filtering)
  const { data: campaignSentData } = useQuery({
    queryKey: ["campaign-sent-emails"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_campaign_recipients")
        .select("email, email_campaigns(id, name, tags)")
        .not("sent_at", "is", null);
      if (error) return { emails: new Set<string>(), emailToTags: new Map<string, string[]>(), allTags: new Set<string>() };
      const emails = new Set<string>();
      const emailToTags = new Map<string, string[]>();
      const allTags = new Set<string>();
      (data || []).forEach((r: any) => {
        const email = r.email?.toLowerCase?.()?.trim();
        if (!email) return;
        emails.add(email);
        const tags = (r.email_campaigns?.tags && Array.isArray(r.email_campaigns.tags)) ? r.email_campaigns.tags : [];
        tags.forEach((t: string) => allTags.add(String(t).trim()));
        const existing = emailToTags.get(email) || [];
        tags.forEach((t: string) => { if (t && !existing.includes(t)) existing.push(t); });
        emailToTags.set(email, existing);
      });
      return { emails, emailToTags, allTags: Array.from(allTags).sort() };
    },
  });

  // Emails that have been sent a newsletter
  const { data: newsletterSentEmails } = useQuery({
    queryKey: ["newsletter-sent-emails"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("newsletter_sends")
        .select("newsletter_subscribers!inner(email)")
        .not("sent_at", "is", null);
      if (error) return new Set<string>();
      const set = new Set<string>();
      (data || []).forEach((row: any) => {
        const email = row?.newsletter_subscribers?.email?.toLowerCase?.()?.trim();
        if (email) set.add(email);
      });
      return set;
    },
  });

  // People emails by company_id (for "sent in campaign/newsletter" filter)
  const { data: peopleEmailsByCompany } = useQuery({
    queryKey: ["people-emails-by-company"],
    queryFn: async () => {
      const { data } = await supabase
        .from("people")
        .select("company_id, email")
        .not("email", "is", null)
        .not("company_id", "is", null);
      const map = new Map<string, string[]>();
      (data || []).forEach((p: any) => {
        if (!p.company_id || !p.email) return;
        const email = p.email.toLowerCase().trim();
        const list = map.get(p.company_id) || [];
        if (!list.includes(email)) list.push(email);
        map.set(p.company_id, list);
      });
      return map;
    },
  });

  const emailsSentInCampaign = campaignSentData?.emails ?? new Set<string>();
  const emailToCampaignTags = campaignSentData?.emailToTags ?? new Map<string, string[]>();
  const allCampaignTagsFromCampaigns: string[] = Array.isArray(campaignSentData?.allTags) ? campaignSentData.allTags : [];
  const emailsSentInNewsletter = newsletterSentEmails ?? new Set<string>();

  // Collect all emails for a company (for sent-in filter)
  const getCompanyEmails = (company: Company): string[] => {
    const out: string[] = [];
    const add = (e: string | null | undefined) => {
      if (e && typeof e === "string") {
        const lower = e.toLowerCase().trim();
        if (lower && !out.includes(lower)) out.push(lower);
      }
    };
    add(company.general_email ?? (company as any).generalEmail);
    (company.contacts || []).forEach((c: any) => add(c?.email));
    (peopleEmailsByCompany?.get(company.id) || []).forEach(add);
    return out;
  };

  // Check if company is already in contacts
  const isCompanyInContacts = (company: Company) => {
    if (!peopleEmails) return false;
    const emailMatch = getCompanyEmailContact(company);
    if (!emailMatch?.email) return false;
    return peopleEmails.has(emailMatch.email.toLowerCase());
  };

  // NEW badge only for companies added within the last 24 hours
  const isCompanyNew = (company: Company) => {
    if (!company.created_at) return false;
    const createdDate = new Date(company.created_at);
    const hoursSinceCreation = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60);
    return hoursSinceCreation <= 24;
  };

  // Bulk email extraction state
  const [extractionProgress, setExtractionProgress] = useState<{
    current: number;
    total: number;
    extracted: number;
    failed: number;
    currentCompany: string;
    status: 'idle' | 'extracting' | 'completed';
  }>({
    current: 0,
    total: 0,
    extracted: 0,
    failed: 0,
    currentCompany: '',
    status: 'idle',
  });

  // Bulk email extraction mutation with batch processing and progress
  const bulkExtractEmailMutation = useMutation({
    mutationFn: async (companyIds: string[]) => {
      const selectedCompanies = companies?.filter(c => companyIds.includes(c.id)) || [];
      
      // Filter companies: no email, has website, and website is valid (not "no-website-")
      const companiesWithoutEmail = selectedCompanies.filter(company => {
        const hasEmail = !!(company.general_email || (company as any).generalEmail || company.contacts?.some(c => c.email));
        const hasValidWebsite = company.website && 
                                !company.website.startsWith('no-website-') && 
                                company.website.trim().length > 0 &&
                                (company.website.startsWith('http') || company.website.includes('.'));
        return !hasEmail && hasValidWebsite;
      });

      if (companiesWithoutEmail.length === 0) {
        throw new Error("No companies without emails and with valid websites selected");
      }

      setExtractionProgress({
        current: 0,
        total: companiesWithoutEmail.length,
        extracted: 0,
        failed: 0,
        currentCompany: '',
        status: 'extracting',
      });

      let extractedCount = 0;
      let failedCount = 0;
      const extractedEmails: Array<{ companyId: string; email: string; companyName: string }> = [];
      const failedCompanies: Array<{ companyId: string; companyName: string; reason: string }> = [];

      // Process ONE company at a time sequentially for better reliability
      for (let i = 0; i < companiesWithoutEmail.length; i++) {
        const company = companiesWithoutEmail[i];
        
        // Update progress
        setExtractionProgress(prev => ({
          ...prev,
          current: i + 1,
          currentCompany: company.name,
        }));

        try {
          // Normalize website URL - be more lenient with validation
          let websiteUrl = company.website?.trim() || '';
          
          // Skip if website is clearly invalid
          if (!websiteUrl || websiteUrl.startsWith('no-website-') || websiteUrl.length < 4) {
            failedCount++;
            failedCompanies.push({
              companyId: company.id,
              companyName: company.name,
              reason: 'Invalid or missing website',
            });
            
            setExtractionProgress(prev => ({
              ...prev,
              failed: failedCount,
            }));
            continue;
          }

          // Ensure URL has protocol
          if (!websiteUrl.startsWith('http://') && !websiteUrl.startsWith('https://')) {
            websiteUrl = `https://${websiteUrl}`;
          }

          // Remove trailing slashes and clean up
          websiteUrl = websiteUrl.replace(/\/+$/, '');

          console.log(`[Bulk Extract] Processing ${i + 1}/${companiesWithoutEmail.length}: ${company.name} - ${websiteUrl}`);

          // Call extraction function with timeout
          const extractionPromise = supabase.functions.invoke('extract-website-email', {
            body: {
              companyId: company.id,
              website: websiteUrl,
              companyName: company.name,
            }
          });

          // Add timeout to prevent hanging
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Extraction timeout (30s)')), 30000)
          );

          const { data, error } = await Promise.race([extractionPromise, timeoutPromise]) as any;

          if (error) {
            throw new Error(error.message || 'Extraction failed');
          }

          if (data?.success && data.email) {
            extractedCount++;
            extractedEmails.push({ 
              companyId: company.id, 
              email: data.email,
              companyName: company.name 
            });
            
            // Show success notification
            toast({
              title: '✓ Email Extracted',
              description: `${company.name}: ${data.email}`,
              duration: 2000,
            });

            // Update cache immediately
            queryClient.setQueryData(['companies-full'], (oldData: any) => {
              if (!oldData) return oldData;
              return oldData.map((c: any) => {
                if (c.id === company.id) {
                  return {
                    ...c,
                    general_email: data.email,
                    generalEmail: data.email,
                  };
                }
                return c;
              });
            });

            // Update progress
            setExtractionProgress(prev => ({
              ...prev,
              extracted: extractedCount,
            }));
          } else {
            failedCount++;
            const reason = data?.error || data?.message || 'No email found on website';
            const details = data?.emailsScanned ? ` (scanned ${data.emailsScanned} emails)` : '';
            const fullReason = `${reason}${details}`;
            
            failedCompanies.push({
              companyId: company.id,
              companyName: company.name,
              reason: fullReason,
            });
            
            // Show failure notification with more details
            console.log(`[Bulk Extract] No email found for ${company.name}:`, {
              reason: fullReason,
              website: company.website,
              pagesTried: data?.pagesTried || 1,
              emailsScanned: data?.emailsScanned || 0,
            });
            
            // Update progress
            setExtractionProgress(prev => ({
              ...prev,
              failed: failedCount,
            }));
          }
        } catch (error: any) {
          failedCount++;
          const errorMsg = error.message || 'Extraction failed';
          failedCompanies.push({
            companyId: company.id,
            companyName: company.name,
            reason: errorMsg,
          });
          
          console.error(`[Bulk Extract] Failed for ${company.name}:`, error);
          
          // Update progress
          setExtractionProgress(prev => ({
            ...prev,
            failed: failedCount,
          }));
        }

        // Small delay between extractions to avoid rate limiting and show progress
        if (i < companiesWithoutEmail.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay between extractions
        }
      }

      setExtractionProgress(prev => ({
        ...prev,
        status: 'completed',
      }));

      return { 
        extractedCount, 
        failedCount, 
        total: companiesWithoutEmail.length,
        extractedEmails,
        failedCompanies,
      };
    },
    onSuccess: async (result) => {
      // Final cache update
      if (result.extractedEmails.length > 0) {
        queryClient.setQueryData(['companies-full'], (oldData: any) => {
          if (!oldData) return oldData;
          return oldData.map((c: any) => {
            const extracted = result.extractedEmails.find(e => e.companyId === c.id);
            if (extracted) {
              return {
                ...c,
                general_email: extracted.email,
                generalEmail: extracted.email,
              };
            }
            return c;
          });
        });
      }

      // Invalidate and refetch to ensure consistency
      await queryClient.invalidateQueries({ queryKey: ['companies-full'] });
      queryClient.invalidateQueries({ queryKey: ['companies-total-count'] });
      await queryClient.refetchQueries({ queryKey: ['companies-full'] });
      
      // Final summary toast with detailed breakdown
      const successRate = result.total > 0 ? Math.round((result.extractedCount / result.total) * 100) : 0;
      
      // Analyze failure reasons
      const failureReasons: Record<string, number> = {};
      result.failedCompanies.forEach(f => {
        const reason = f.reason.toLowerCase();
        if (reason.includes('timeout') || reason.includes('connection')) {
          failureReasons['Connection/Timeout'] = (failureReasons['Connection/Timeout'] || 0) + 1;
        } else if (reason.includes('invalid') || reason.includes('format')) {
          failureReasons['Invalid Website'] = (failureReasons['Invalid Website'] || 0) + 1;
        } else if (reason.includes('no email') || reason.includes('not found')) {
          failureReasons['No Email on Site'] = (failureReasons['No Email on Site'] || 0) + 1;
        } else {
          failureReasons['Other'] = (failureReasons['Other'] || 0) + 1;
        }
      });
      
      const failureBreakdown = Object.entries(failureReasons)
        .map(([reason, count]) => `${reason}: ${count}`)
        .join(', ');
      
      toast({
        title: 'Email Extraction Complete',
        description: `Extracted ${result.extractedCount} email(s) from ${result.total} companies (${successRate}% success rate). ${result.failedCount} failed.${failureBreakdown ? ` Breakdown: ${failureBreakdown}` : ''}`,
        duration: 8000,
      });
      
      // Log detailed failure analysis
      console.log('[Bulk Extract] Detailed failure analysis:', {
        total: result.total,
        extracted: result.extractedCount,
        failed: result.failedCount,
        successRate: `${successRate}%`,
        failureReasons,
        sampleFailures: result.failedCompanies.slice(0, 5).map(f => ({
          company: f.companyName,
          website: companies?.find(c => c.id === f.companyId)?.website,
          reason: f.reason,
        })),
      });

      // Reset progress after a delay
      setTimeout(() => {
        setExtractionProgress({
          current: 0,
          total: 0,
          extracted: 0,
          failed: 0,
          currentCompany: '',
          status: 'idle',
        });
      }, 3000);
    },
    onError: (error: any) => {
      setExtractionProgress(prev => ({
        ...prev,
        status: 'idle',
      }));
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to extract emails', 
        variant: 'destructive' 
      });
    },
  });

  // Bulk delete mutation (batched to avoid URL/query size limits with 1000+ IDs)
  const BULK_DELETE_BATCH_SIZE = 100;
  const bulkDeleteMutation = useMutation({
    mutationFn: async (companyIds: string[]) => {
      let deleted = 0;
      for (let i = 0; i < companyIds.length; i += BULK_DELETE_BATCH_SIZE) {
        const batch = companyIds.slice(i, i + BULK_DELETE_BATCH_SIZE);
        const { error } = await supabase
          .from('companies')
          .delete()
          .in('id', batch);
        if (error) throw error;
        deleted += batch.length;
      }
      return { deleted };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['companies-full'] });
      queryClient.invalidateQueries({ queryKey: ['companies-total-count'] });
      queryClient.invalidateQueries({ queryKey: ['company-existing-tags'] });
      setSelectedCompanyIds(new Set());
      setBulkDeleteDialogOpen(false);
      toast({ title: 'Success', description: `Deleted ${result.deleted} companies` });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const getCompanyEmailContact = (company: Company) => {
    const contactWithEmail = company.contacts?.find(contact => contact.email);
    if (contactWithEmail?.email) {
      return { type: "contact" as const, contact: contactWithEmail, email: contactWithEmail.email };
    }
    const companyEmail = company.general_email || (company as any).generalEmail;
    if (companyEmail) {
      return { type: "company" as const, contact: null, email: companyEmail };
    }
    return null;
  };

  const addToPeopleMutation = useMutation({
    mutationFn: async (company: Company) => {
      const match = getCompanyEmailContact(company);
      if (!match?.email) {
        throw new Error("No email available for this company");
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Intelligent duplicate check: check by email (case-insensitive)
      const { data: existingPerson } = await supabase
        .from("people")
        .select("id, email, first_name, last_name, company_id")
        .ilike("email", match.email)
        .maybeSingle();

      if (existingPerson) {
        // If exists but company_id is different, update it
        if (existingPerson.company_id !== company.id && company.id) {
          await supabase
            .from("people")
            .update({ company_id: company.id })
            .eq("id", existingPerson.id);
        }
        return { status: "exists" as const, person: existingPerson };
      }

      let firstName = company.name;
      let lastName = "";

      if (match.type === "contact" && match.contact?.name) {
        const nameParts = match.contact.name.trim().split(" ");
        firstName = nameParts[0] || company.name;
        lastName = nameParts.slice(1).join(" ");
      }

      const { data: newPerson, error } = await supabase
        .from("people")
        .insert({
          user_id: user.id,
          first_name: firstName,
          last_name: lastName,
          email: match.email,
          phone: match.contact?.phone || null,
          title: match.contact?.title || null,
          company_id: company.id,
          linkedin_url: match.contact?.linkedin_url || null,
        })
        .select()
        .single();

      if (error) throw error;

      return { status: "added" as const, person: newPerson };
    },
    onSuccess: (result, company) => {
      queryClient.invalidateQueries({ queryKey: ["people"] });
      queryClient.invalidateQueries({ queryKey: ["people-emails"] });
      toast({
        title: result.status === "exists" ? "Already in Contacts" : "Added to Contacts",
        description:
          result.status === "exists"
            ? `${company.name} is already in People`
            : `${company.name} was added to People`,
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Bulk add to contacts mutation with intelligent duplicate handling
  const bulkAddToContactsMutation = useMutation({
    mutationFn: async (companyIds: string[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const selectedCompanies = companies?.filter(c => companyIds.includes(c.id)) || [];
      
      // Filter companies that have emails
      const companiesWithEmails = selectedCompanies.filter(company => {
        const match = getCompanyEmailContact(company);
        return !!match?.email;
      });

      if (companiesWithEmails.length === 0) {
        throw new Error("No companies with emails selected");
      }

      // Get all existing people emails for duplicate checking
      const { data: existingPeople } = await supabase
        .from("people")
        .select("id, email, company_id");

      const existingEmails = new Set(
        (existingPeople || []).map(p => p.email?.toLowerCase()).filter(Boolean)
      );
      const existingPeopleByEmail = new Map(
        (existingPeople || []).map(p => [p.email?.toLowerCase(), p])
      );

      let addedCount = 0;
      let skippedCount = 0;
      let updatedCount = 0;
      const skippedCompanies: Array<{ name: string; reason: string }> = [];
      const peopleToInsert: Array<any> = [];

      for (const company of companiesWithEmails) {
        const match = getCompanyEmailContact(company);
        if (!match?.email) continue;

        const emailLower = match.email.toLowerCase();
        
        // Check if email already exists
        if (existingEmails.has(emailLower)) {
          const existingPerson = existingPeopleByEmail.get(emailLower);
          // Update company_id if different
          if (existingPerson && existingPerson.company_id !== company.id && company.id) {
            await supabase
              .from("people")
              .update({ company_id: company.id })
              .eq("id", existingPerson.id);
            updatedCount++;
          } else {
            skippedCount++;
            skippedCompanies.push({
              name: company.name,
              reason: "Email already exists in contacts",
            });
          }
          continue;
        }

        // Prepare contact data
        let firstName = company.name;
        let lastName = "";

        if (match.type === "contact" && match.contact?.name) {
          const nameParts = match.contact.name.trim().split(" ");
          firstName = nameParts[0] || company.name;
          lastName = nameParts.slice(1).join(" ");
        }

        peopleToInsert.push({
          user_id: user.id,
          first_name: firstName,
          last_name: lastName,
          email: match.email,
          phone: match.contact?.phone || null,
          title: match.contact?.title || null,
          company_id: company.id,
          linkedin_url: match.contact?.linkedin_url || null,
        });

        // Track this email to avoid duplicates within the batch
        existingEmails.add(emailLower);
      }

      // Insert all new contacts in batch
      if (peopleToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from("people")
          .insert(peopleToInsert);

        if (insertError) throw insertError;
        addedCount = peopleToInsert.length;
      }

      return {
        added: addedCount,
        skipped: skippedCount,
        updated: updatedCount,
        total: companiesWithEmails.length,
        skippedCompanies,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["people"] });
      queryClient.invalidateQueries({ queryKey: ["people-emails"] });
      
      const parts: string[] = [];
      if (result.added > 0) parts.push(`${result.added} added`);
      if (result.updated > 0) parts.push(`${result.updated} updated`);
      if (result.skipped > 0) parts.push(`${result.skipped} skipped (duplicates)`);

      toast({
        title: "Bulk Add to Contacts Complete",
        description: `Processed ${result.total} companies: ${parts.join(", ")}`,
        duration: 5000,
      });

      if (result.skippedCompanies.length > 0 && result.skippedCompanies.length <= 5) {
        console.log("Skipped companies:", result.skippedCompanies);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error adding to contacts",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleCompanySelection = (companyId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedCompanyIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(companyId)) {
        newSet.delete(companyId);
      } else {
        newSet.add(companyId);
      }
      return newSet;
    });
  };

  const toggleSourceGroupSelection = (companyIds: string[], e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedCompanyIds(prev => {
      const newSet = new Set(prev);
      const allSelected = companyIds.every(id => newSet.has(id));
      if (allSelected) {
        companyIds.forEach(id => newSet.delete(id));
      } else {
        companyIds.forEach(id => newSet.add(id));
      }
      return newSet;
    });
  };

  // Add selected companies to Enrichment Queue (for re-enrichment / email extraction)
  const addToEnrichmentMutation = useMutation({
    mutationFn: async (companyIds: string[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const selected = (companies || []).filter(c => companyIds.includes(c.id));
      const inserts = selected.map(c => ({
        user_id: user.id,
        name: c.name,
        website: c.website || null,
        industry: c.industry || null,
        geography: c.geography || null,
        email: c.general_email || (c as any).generalEmail || (c.contacts?.find((x: any) => x.email) as any)?.email || null,
        phone: (c as any).company_phone || (c.contacts?.find((x: any) => x.phone) as any)?.phone || null,
        source: 'import',
        source_metadata: { from: 'companies', company_id: c.id },
        enrichment_status: 'pending',
        email_extraction_status: (c.website && !(c.general_email || (c as any).generalEmail)) ? 'pending' : 'not_needed',
      }));
      const { data, error } = await (supabase as any).from('enrichment_queue').insert(inserts).select('id');
      if (error) throw error;
      return { count: data?.length ?? 0 };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['enrichment-queue'] });
      setSelectedCompanyIds(new Set());
      toast({
        title: 'Added to Enrichment Queue',
        description: `${result.count} companies added. Run enrichment on the Enrichment page.`,
      });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const toggleSelectAll = () => {
    if (selectedCompanyIds.size === (paginatedCompanies?.length || 0) && (paginatedCompanies?.length || 0) > 0) {
      const onPage = new Set(paginatedCompanies!.map(c => c.id));
      const allOnPageSelected = onPage.size > 0 && [...onPage].every(id => selectedCompanyIds.has(id));
      if (allOnPageSelected) {
        setSelectedCompanyIds(prev => { const next = new Set(prev); onPage.forEach(id => next.delete(id)); return next; });
      } else {
        setSelectedCompanyIds(prev => { const next = new Set(prev); onPage.forEach(id => next.add(id)); return next; });
      }
    } else {
      const onPage = new Set((paginatedCompanies || []).map(c => c.id));
      setSelectedCompanyIds(prev => { const next = new Set(prev); onPage.forEach(id => next.add(id)); return next; });
    }
  };

  const toggleSelectAllFiltered = () => {
    if (!filteredCompanies?.length) return;
    const allFilteredIds = new Set(filteredCompanies.map(c => c.id));
    const allSelected = allFilteredIds.size > 0 && [...allFilteredIds].every(id => selectedCompanyIds.has(id));
    if (allSelected) {
      setSelectedCompanyIds(prev => { const next = new Set(prev); allFilteredIds.forEach(id => next.delete(id)); return next; });
    } else {
      setSelectedCompanyIds(prev => { const next = new Set(prev); allFilteredIds.forEach(id => next.add(id)); return next; });
    }
  };

  const handleBulkDelete = () => {
    bulkDeleteMutation.mutate(Array.from(selectedCompanyIds));
  };

  const mapCompanyRow = (company: any): Company => {
    const enrichmentData = company.enrichment_data as any;
    return {
      ...company,
      enrichment_data: company.enrichment_data,
      linkedinUrl: company.linkedin_url,
      companyPhone: company.company_phone,
      generalEmail: company.general_email,
      employeeCount: company.employee_count,
      socialProfiles: company.social_profiles as any,
      keyExecutives: company.key_executives as any,
      techStack: company.tech_stack,
      tags: company.tags || [],
      products: enrichmentData?.products,
      recentNews: company.recent_news || enrichmentData?.recentNews,
      fundingInfo: enrichmentData?.fundingInfo ||
        (company.funding_stage || company.funding_total
          ? `${company.funding_stage || ''}${company.funding_stage && company.funding_total ? ' - ' : ''}${company.funding_total || ''}`
          : undefined),
      wasEnriched: company.enrichment_status === 'completed',
    } as unknown as Company;
  };

  // Supabase/PostgREST returns max 1000 rows per request; fetch in chunks to support 2000+ per page
  const ROWS_PER_CHUNK = 1000;
  const MAX_COMPANIES_LOAD = 15000;

  const { data: companies, isLoading } = useQuery({
    queryKey: ["companies-full"],
    queryFn: async () => {
      const all: any[] = [];
      let offset = 0;
      while (offset < MAX_COMPANIES_LOAD) {
        const { data, error } = await supabase
          .from("companies")
          .select("*, contacts(*), deals(*), people(*)")
          .order("created_at", { ascending: false })
          .range(offset, offset + ROWS_PER_CHUNK - 1);
        if (error) throw error;
        const chunk = data || [];
        all.push(...chunk);
        if (chunk.length < ROWS_PER_CHUNK) break;
        offset += ROWS_PER_CHUNK;
      }
      return all.map(mapCompanyRow);
    },
  });

  // When search/date/source filters are active, fetch matching companies from the whole DB (holistic) so "Select all filtered" includes every match
  const hasServerFilters = !!(
    searchQuery.trim() ||
    (dateAddedPreset !== "all" || dateAddedFrom || dateAddedTo) ||
    sourceFilter
  );
  const { data: companiesFiltered, isLoading: isLoadingFiltered } = useQuery({
    queryKey: [
      "companies-filtered",
      searchQuery.trim(),
      dateAddedPreset,
      dateAddedFrom ?? "",
      dateAddedTo ?? "",
      dateAddedFromTime ?? "",
      dateAddedToTime ?? "",
      sourceFilter ?? "",
    ],
    enabled: hasServerFilters,
    queryFn: async ({ queryKey }) => {
      const [, search, datePreset, dateFrom, dateTo, dateFromTime, dateToTime, source] = queryKey as [
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
      ];
      let builder = supabase
        .from("companies")
        .select("*, contacts(*), deals(*), people(*)")
        .order("created_at", { ascending: false });

      if (search) {
        const safe = search
          .replace(/'/g, "''")
          .replace(/\\/g, "\\\\")
          .replace(/%/g, "\\%")
          .replace(/_/g, "\\_")
          .replace(/,/g, " ");
        const pattern = `%${safe}%`;
        builder = builder.or(
          `name.ilike.${pattern},website.ilike.${pattern},description.ilike.${pattern},industry.ilike.${pattern},general_email.ilike.${pattern}`
        );
      }

      let fromIso: string | null = null;
      let toIso: string | null = null;
      if (datePreset === "custom" && (dateFrom || dateTo)) {
        if (dateFrom) fromIso = dateFromTime ? `${dateFrom}T${dateFromTime}:00` : `${dateFrom}T00:00:00`;
        if (dateTo) toIso = dateToTime ? `${dateTo}T${dateToTime}:59.999` : `${dateTo}T23:59:59.999`;
      } else if (datePreset === "today") {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        fromIso = d.toISOString();
        toIso = new Date().toISOString();
      } else if (datePreset === "yesterday") {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        d.setHours(0, 0, 0, 0);
        fromIso = d.toISOString();
        d.setHours(23, 59, 59, 999);
        toIso = d.toISOString();
      } else if (datePreset === "last7") {
        fromIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        toIso = new Date().toISOString();
      } else if (datePreset === "last30") {
        fromIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        toIso = new Date().toISOString();
      } else if (datePreset === "last90") {
        fromIso = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
        toIso = new Date().toISOString();
      }
      if (fromIso) builder = builder.gte("created_at", fromIso);
      if (toIso) builder = builder.lte("created_at", toIso);
      if (source) builder = builder.contains("tags", [source]);

      // Fetch in chunks (PostgREST max 1000 per request) to get up to 50k rows
      const MAX_FILTERED_LOAD = 50000;
      const all: any[] = [];
      let offset = 0;
      while (offset < MAX_FILTERED_LOAD) {
        const { data: chunk, error } = await builder
          .range(offset, offset + ROWS_PER_CHUNK - 1);
        if (error) throw error;
        const rows = chunk || [];
        all.push(...rows);
        if (rows.length < ROWS_PER_CHUNK) break;
        offset += ROWS_PER_CHUNK;
      }
      return all.map(mapCompanyRow);
    },
  });

  // Base list: when server filters are active use the filtered fetch (whole DB); otherwise use default load
  const baseCompanies = hasServerFilters && companiesFiltered != null ? companiesFiltered : companies ?? [];

  const { data: companiesTotalCount } = useQuery({
    queryKey: ["companies-total-count"],
    queryFn: async () => {
      const { count } = await supabase.from("companies").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const SELECTED_COMPANY_IDS_KEY = 'leadboosters_selected_company_ids';
  const hasRestoredCompanySelection = useRef(false);
  const [openedFromDraft, setOpenedFromDraft] = useState(false);
  useEffect(() => {
    setOpenedFromDraft(!!window.opener);
  }, []);

  // Restore selected company IDs from localStorage when companies first load
  useEffect(() => {
    if (!companies?.length || hasRestoredCompanySelection.current) return;
    hasRestoredCompanySelection.current = true;
    try {
      const raw = sessionStorage.getItem(SELECTED_COMPANY_IDS_KEY);
      if (!raw) return;
      const ids = JSON.parse(raw) as string[];
      if (Array.isArray(ids) && ids.length > 0) {
        const validIds = ids.filter(id => companies.some(c => c.id === id));
        if (validIds.length > 0) {
          setSelectedCompanyIds(new Set(validIds));
        }
      }
    } catch {
      // ignore
    }
  }, [companies]);

  // Persist selected company IDs to localStorage when selection changes
  useEffect(() => {
    try {
      sessionStorage.setItem(SELECTED_COMPANY_IDS_KEY, JSON.stringify(Array.from(selectedCompanyIds)));
    } catch {
      // ignore
    }
  }, [selectedCompanyIds]);

  // Get all unique tags from currently loaded companies (intelligent tags)
  // Extract from both company.tags AND enrichment_data.suggestedTags
  const allCompanyTagsFromData = useMemo(() => {
    const tagsSet = new Set<string>();
    let companiesWithEnrichmentData = 0;
    let companiesWithSuggestedTags = 0;
    let companiesWithTagsColumn = 0;
    const sampleEnrichmentData: any[] = [];
    
    if (companies && Array.isArray(companies)) {
      companies.forEach((company, index) => {
        // Extract from company.tags array (applied tags)
        if (company.tags && Array.isArray(company.tags) && company.tags.length > 0) {
          companiesWithTagsColumn++;
          company.tags.forEach((tag: string) => {
            if (tag && typeof tag === 'string' && tag.trim()) {
              tagsSet.add(tag.trim());
            }
          });
        }
        
        // Also extract from enrichment_data.suggestedTags (where AI tags are often stored)
        const enrichmentData = company.enrichment_data as any;
        
        // Debug first 10 companies to see structure
        if (index < 10 && enrichmentData) {
          sampleEnrichmentData.push({
            name: company.name,
            enrichmentData: enrichmentData,
            enrichmentDataKeys: Object.keys(enrichmentData),
            suggestedTags: enrichmentData?.suggestedTags,
            suggested_tags: enrichmentData?.suggested_tags,
            tags: company.tags
          });
        }
        
        if (enrichmentData) {
          companiesWithEnrichmentData++;
          
          // Check multiple possible paths for suggestedTags
          const suggestedTags = enrichmentData.suggestedTags || 
                                enrichmentData.suggested_tags ||
                                enrichmentData.suggestedTagsArray ||
                                null;
          
          if (suggestedTags && Array.isArray(suggestedTags) && suggestedTags.length > 0) {
            companiesWithSuggestedTags++;
            suggestedTags.forEach((tag: string) => {
              if (tag && typeof tag === 'string' && tag.trim()) {
                tagsSet.add(tag.trim());
              }
            });
          }
          
          // Also check if tags might be stored as a string that needs parsing
          if (typeof suggestedTags === 'string') {
            try {
              const parsed = JSON.parse(suggestedTags);
              if (Array.isArray(parsed)) {
                parsed.forEach((tag: string) => {
                  if (tag && typeof tag === 'string' && tag.trim()) {
                    tagsSet.add(tag.trim());
                  }
                });
              }
            } catch (e) {
              // Not JSON, ignore
            }
          }
        }
      });
    }
    
    // Debug: log intelligent tags found
    console.log('=== TAG EXTRACTION DEBUG ===');
    console.log('[Companies] Total companies:', companies?.length || 0);
    console.log('[Companies] Companies with tags column:', companiesWithTagsColumn);
    console.log('[Companies] Companies with enrichment_data:', companiesWithEnrichmentData);
    console.log('[Companies] Companies with suggestedTags in enrichment:', companiesWithSuggestedTags);
    console.log('[Companies] Intelligent tags found:', Array.from(tagsSet).sort());
    console.log('[Companies] Total unique intelligent tags:', tagsSet.size);
    console.log('[Companies] Sample enrichment data (first 10):', sampleEnrichmentData);
    console.log('=== END TAG DEBUG ===');
    
    return tagsSet;
  }, [companies]);

  // Prioritize intelligent tags from actual company data over generic defaults
  const combinedSuggestions = useMemo(() => {
    // Combine: virtual "No tags" category first, then actual company tags, then presets and defaults
    const combined = new Set<string>();
    combined.add(UNTAGGED_CATEGORY);
    
    // Add all tags from actual companies (intelligent tags)
    const intelligentTags = Array.from(allCompanyTagsFromData);
    intelligentTags.forEach(tag => combined.add(tag));
    
    // Then add suggestions from hook (presets + existing tags from DB + defaults)
    (allSuggestions || []).forEach(tag => combined.add(tag));
    
    const finalSuggestions = Array.from(combined).sort();
    
    console.log('[CombinedSuggestions] Breakdown:', {
      intelligentTagsCount: intelligentTags.length,
      intelligentTags: intelligentTags.slice(0, 20),
      allSuggestionsCount: allSuggestions?.length || 0,
      allSuggestionsSample: allSuggestions?.slice(0, 10) || [],
      finalCount: finalSuggestions.length,
      finalSample: finalSuggestions.slice(0, 20)
    });
    
    return finalSuggestions;
  }, [allCompanyTagsFromData, allSuggestions]);

  // Check if tags need to be migrated on load
  useEffect(() => {
    if (companies && companies.length > 0) {
      const companiesWithTags = companies.filter(c => 
        (c.tags && Array.isArray(c.tags) && c.tags.length > 0)
      ).length;
      const companiesWithEnrichment = companies.filter(c => {
        const ed = c.enrichment_data as any;
        return ed?.suggestedTags && Array.isArray(ed.suggestedTags) && ed.suggestedTags.length > 0;
      }).length;
      
      // If we have companies with enrichment tags but not applied tags, show prompt
      if (companiesWithEnrichment > companiesWithTags && companiesWithEnrichment > 0) {
        setShowTagMigrationPrompt(true);
      }
    }
  }, [companies]);

  // Check if tags need to be migrated on load (after companies are loaded)
  useEffect(() => {
    if (companies && companies.length > 0) {
      const companiesWithTags = companies.filter(c => 
        (c.tags && Array.isArray(c.tags) && c.tags.length > 0)
      ).length;
      const companiesWithEnrichment = companies.filter(c => {
        const ed = c.enrichment_data as any;
        return ed?.suggestedTags && Array.isArray(ed.suggestedTags) && ed.suggestedTags.length > 0;
      }).length;
      
      // If we have companies with enrichment tags but not applied tags, show prompt
      if (companiesWithEnrichment > companiesWithTags && companiesWithEnrichment > 0) {
        setShowTagMigrationPrompt(true);
      }
    }
  }, [companies]);

  // Sync selectedCompany with updated companies data
  useEffect(() => {
    if (selectedCompany && companies) {
      const updatedCompany = companies.find(c => c.id === selectedCompany.id);
      if (updatedCompany && updatedCompany.general_email !== selectedCompany.general_email) {
        setSelectedCompany(updatedCompany);
      }
    }
  }, [companies, selectedCompany?.id]);

  // Filter companies by selected tags and email status (runs on baseCompanies: full DB when server filters active, else loaded set)
  const filteredCompanies = useMemo(() => {
    if (!baseCompanies?.length) return [];
    
    // Debug: Check how many companies have tags
    const companiesWithTags = baseCompanies.filter(c => {
      const hasTags = (c.tags && Array.isArray(c.tags) && c.tags.length > 0);
      const enrichmentData = c.enrichment_data as any;
      const hasSuggestedTags = enrichmentData?.suggestedTags && Array.isArray(enrichmentData.suggestedTags) && enrichmentData.suggestedTags.length > 0;
      return hasTags || hasSuggestedTags;
    });
    
    console.log('[Filter] Starting filter with:', {
      totalCompanies: baseCompanies.length,
      companiesWithTags: companiesWithTags.length,
      selectedTagFilters,
      selectedTagFiltersCount: selectedTagFilters.length,
      sampleCompanyTags: baseCompanies.slice(0, 5).map(c => ({
        name: c.name,
        tags: c.tags,
        suggestedTags: (c.enrichment_data as any)?.suggestedTags
      }))
    });
    
    const filtered = baseCompanies.filter(company => {
      // Search filter - search across company name, website, description, industry, email, and tags (group/category)
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const name = (company.name || '').toLowerCase();
        const website = (company.website || '').toLowerCase();
        const description = (company.description || '').toLowerCase();
        const industry = (company.industry || '').toLowerCase();
        const email = (company.general_email || (company as any).generalEmail || '').toLowerCase();
        const companyTags = (company.tags || []).map((t: string) => String(t).toLowerCase()).filter(Boolean);
        const enrichmentData = company.enrichment_data as any;
        const suggestedTags = (enrichmentData?.suggestedTags || []).map((t: string) => String(t).toLowerCase()).filter(Boolean);
        const allTags = [...companyTags, ...suggestedTags];
        const matchesTag = allTags.some((tag: string) => tag.includes(query) || query.includes(tag));
        
        const matchesSearch = 
          name.includes(query) ||
          website.includes(query) ||
          description.includes(query) ||
          industry.includes(query) ||
          email.includes(query) ||
          matchesTag;
        
        if (!matchesSearch) {
          return false;
        }
      }
      
      // Tag filter - case-insensitive matching with trimmed tags
      // Check both company.tags AND enrichment_data.suggestedTags
      if (selectedTagFilters.length > 0) {
        // Get tags from company.tags array (already applied tags)
        const companyTags = (company.tags || []).map((tag: string) => 
          typeof tag === 'string' ? tag.trim().toLowerCase() : String(tag).toLowerCase()
        ).filter(Boolean);
        
        // Also get tags from enrichment_data.suggestedTags (AI-generated intelligent tags)
        const enrichmentData = company.enrichment_data as any;
        let suggestedTags: string[] = [];
        
        if (enrichmentData) {
          // Check various possible locations for suggestedTags
          let possibleTags = enrichmentData.suggestedTags || 
                            enrichmentData.suggested_tags ||
                            enrichmentData.suggestedTagsArray ||
                            null;
          
          // If it's a string, try to parse it
          if (typeof possibleTags === 'string') {
            try {
              const parsed = JSON.parse(possibleTags);
              possibleTags = parsed;
            } catch (e) {
              // Not JSON, might be comma-separated
              if (possibleTags.includes(',')) {
                possibleTags = possibleTags.split(',').map((t: string) => t.trim()).filter(Boolean);
              }
            }
          }
          
          if (Array.isArray(possibleTags) && possibleTags.length > 0) {
            suggestedTags = possibleTags.map((tag: string) => 
              typeof tag === 'string' ? tag.trim().toLowerCase() : String(tag).toLowerCase()
            ).filter(Boolean);
          }
        }
        
        // Combine both sources - tags from column AND suggestedTags from enrichment
        const allCompanyTags = [...companyTags, ...suggestedTags];
        const selectedTagsLower = selectedTagFilters.map(tag => tag.trim().toLowerCase()).filter(Boolean);
        const untaggedSelected = selectedTagsLower.includes(UNTAGGED_CATEGORY.toLowerCase());
        const companyHasNoTags = allCompanyTags.length === 0;
        const otherSelectedTags = selectedTagsLower.filter(t => t !== UNTAGGED_CATEGORY.toLowerCase());

        // Match "No tags" category (companies without any tags), or match any of the other selected tags (OR logic)
        const matchNoTags = untaggedSelected && companyHasNoTags;
        let matchOtherTags = false;
        if (otherSelectedTags.length > 0) {
          const normalizeTag = (tag: string) => tag.toLowerCase().trim().replace(/\s+/g, ' ');
          const normalizedCompanyTags = allCompanyTags.map(normalizeTag);
          matchOtherTags = otherSelectedTags.some(selectedTag =>
            normalizedCompanyTags.includes(selectedTag) ||
            normalizedCompanyTags.some(companyTag =>
              companyTag.includes(selectedTag) || selectedTag.includes(companyTag)
            )
          );
        }
        const tagMatch = matchNoTags || matchOtherTags;
        if (!tagMatch) return false;
      }

    // Email status filter
    if (emailStatusFilter !== 'all') {
      const hasEmail = !!(company.general_email || (company as any).generalEmail || company.contacts?.some(c => c.email));
      const hasPhone = !!(
        (company as any).company_phone ||
        company.contacts?.some((c: any) => c.phone && String(c.phone).trim())
      );
      const inContacts = isCompanyInContacts(company);

      switch (emailStatusFilter) {
        case 'has-email':
          if (!hasEmail) return false;
          break;
        case 'has-email-and-phone':
          // Only businesses with both email and phone (contactable)
          if (!hasEmail || !hasPhone) return false;
          break;
        case 'has-email-not-in-contacts':
          if (!hasEmail || inContacts) return false;
          break;
        case 'in-contacts':
          if (!inContacts) return false;
          break;
        case 'no-email':
          if (hasEmail) return false;
          break;
      }
    }

    // Sent in campaign / newsletter filter
    if (sentInFilter !== 'all') {
      const companyEmails = getCompanyEmails(company);
      const anySentCampaign = companyEmails.some(e => emailsSentInCampaign.has(e));
      const anySentNewsletter = companyEmails.some(e => emailsSentInNewsletter.has(e));
      switch (sentInFilter) {
        case 'sent-campaign':
          if (!anySentCampaign) return false;
          break;
        case 'sent-newsletter':
          if (!anySentNewsletter) return false;
          break;
        case 'not-sent':
          if (anySentCampaign || anySentNewsletter) return false;
          break;
      }
    }

    // Campaign/Newsletter tag filter: show companies whose email was sent a campaign with any of these tags
    if (selectedCampaignTagFilters.length > 0) {
      const companyEmails = getCompanyEmails(company);
      const hasMatchingTag = companyEmails.some(email => {
        const tags = emailToCampaignTags.get(email) || [];
        return selectedCampaignTagFilters.some(selected => tags.includes(selected));
      });
      if (!hasMatchingTag) return false;
    }

    // Date added filter
    if (dateAddedPreset !== 'all' || dateAddedFrom || dateAddedTo) {
      const created = company.created_at ? new Date(company.created_at).getTime() : 0;
      if (!created) return false;
      let fromTs: number | null = null;
      let toTs: number | null = null;
      if (dateAddedPreset === 'custom' && (dateAddedFrom || dateAddedTo)) {
        if (dateAddedFrom) fromTs = new Date(dateAddedFrom + (dateAddedFromTime ? `T${dateAddedFromTime}` : 'T00:00:00')).getTime();
        if (dateAddedTo) toTs = new Date(dateAddedTo + (dateAddedToTime ? `T${dateAddedToTime}` : 'T23:59:59.999')).getTime();
      } else if (dateAddedPreset === 'today') {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        fromTs = d.getTime();
        toTs = dateAddedToTime ? new Date(d.toDateString() + 'T' + dateAddedToTime).getTime() : Date.now();
        if (dateAddedFromTime) fromTs = new Date(d.toDateString() + 'T' + dateAddedFromTime).getTime();
      } else if (dateAddedPreset === 'yesterday') {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        d.setHours(0, 0, 0, 0);
        fromTs = dateAddedFromTime ? new Date(d.toDateString() + 'T' + dateAddedFromTime).getTime() : d.getTime();
        d.setHours(23, 59, 59, 999);
        toTs = dateAddedToTime ? new Date(d.toDateString() + 'T' + dateAddedToTime).getTime() : d.getTime();
      } else if (dateAddedPreset === 'last7') {
        fromTs = Date.now() - 7 * (24 * 60 * 60 * 1000);
        toTs = Date.now();
      } else if (dateAddedPreset === 'last30') {
        fromTs = Date.now() - 30 * (24 * 60 * 60 * 1000);
        toTs = Date.now();
      } else if (dateAddedPreset === 'last90') {
        fromTs = Date.now() - 90 * (24 * 60 * 60 * 1000);
        toTs = Date.now();
      }
      if (fromTs !== null && created < fromTs) return false;
      if (toTs !== null && created > toTs) return false;
    }

      return true;
    });
    
    console.log('[Filter] Filter result:', {
      totalCompanies: baseCompanies.length,
      filteredCount: filtered.length,
      selectedTags: selectedTagFilters,
      companiesWithAnyTags: companiesWithTags.length
    });
    
    // If filtering by tags but no companies match, log detailed info
    if (selectedTagFilters.length > 0 && filtered.length === 0) {
      console.warn('[Filter] ⚠️ No companies matched the selected tags:', selectedTagFilters);
      
      // Find companies that might have similar tags - improved extraction
      const potentialMatches = baseCompanies.slice(0, 10).map(c => {
        const enrichmentData = c.enrichment_data as any;
        const companyTags = ((c.tags || []) as string[]).map((t: string) => typeof t === 'string' ? t.toLowerCase() : String(t).toLowerCase());
        
        let suggestedTags: string[] = [];
        let possibleSt: any = enrichmentData?.suggestedTags || enrichmentData?.suggested_tags || enrichmentData?.suggestedTagsArray || null;
        
        if (typeof possibleSt === 'string') {
          try {
            possibleSt = JSON.parse(possibleSt);
          } catch (e) {
            if (possibleSt.includes(',')) {
              possibleSt = possibleSt.split(',').map((t: string) => t.trim()).filter(Boolean);
            }
          }
        }
        
        if (Array.isArray(possibleSt)) {
          suggestedTags = possibleSt.map((t: string) => typeof t === 'string' ? t.toLowerCase() : String(t).toLowerCase());
        }
        
        const allTags = [...companyTags, ...suggestedTags];
        const selectedLower = selectedTagFilters.map(t => t.toLowerCase());
        
        return {
          name: c.name,
          tags: c.tags || [],
          suggestedTags: possibleSt,
          allTagsLower: allTags,
          selectedTagsLower: selectedLower,
          hasSimilarTag: selectedLower.some(selected => 
            allTags.some(tag => tag === selected || tag.includes(selected) || selected.includes(tag))
          )
        };
      }).filter(c => c.hasSimilarTag || c.allTagsLower.length > 0);
      
      console.warn('[Filter] 🔍 Companies with tags (potential matches):', potentialMatches);
      console.warn('[Filter] 💡 Tip: Click "Apply Intelligent Tags to Companies" button to migrate tags from enrichment data');
      console.warn('[Filter] 💡 Selected tags:', selectedTagFilters.map(t => t.toLowerCase()));
    }
    
    // Source filter: when set, keep only companies with that source tag
    let bySource = filtered;
    if (sourceFilter) {
      bySource = filtered.filter((c) => getCompanySource(c) === sourceFilter);
    }

    // Sort by created_at descending (newest first) to show recently added companies first
    const sorted = bySource.sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA; // Descending order (newest first)
    });
    
    return sorted;
  }, [baseCompanies, selectedTagFilters, emailStatusFilter, peopleEmails, searchQuery, sourceFilter, sentInFilter, selectedCampaignTagFilters, emailsSentInCampaign, emailsSentInNewsletter, emailToCampaignTags, peopleEmailsByCompany, dateAddedPreset, dateAddedFrom, dateAddedTo, dateAddedFromTime, dateAddedToTime]);

  const totalCompaniesPages = Math.max(1, Math.ceil((filteredCompanies?.length ?? 0) / companiesPageSize));
  const paginatedCompanies = useMemo(() => {
    if (!filteredCompanies?.length) return [];
    const start = (companiesPage - 1) * companiesPageSize;
    return filteredCompanies.slice(start, start + companiesPageSize);
  }, [filteredCompanies, companiesPage, companiesPageSize]);

  // Group filtered companies by source for display (when groupBySource is true) — use paginated list
  const companiesGroupedBySource = useMemo(() => {
    if (!groupBySource || !paginatedCompanies.length) return null;
    const groups: Record<string, Company[]> = {};
    const order = [...SOURCE_TAG_LIST, "Other"];
    order.forEach((label) => { groups[label] = []; });
    for (const company of paginatedCompanies) {
      const source = getCompanySource(company) || "Other";
      if (!groups[source]) groups[source] = [];
      groups[source].push(company);
    }
    return order.filter((label) => (groups[label]?.length ?? 0) > 0).map((label) => ({ label, companies: groups[label] }));
  }, [groupBySource, paginatedCompanies]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCompaniesPage(1);
  }, [searchQuery, selectedTagFilters, emailStatusFilter, sentInFilter, selectedCampaignTagFilters, sourceFilter, dateAddedPreset, dateAddedFrom, dateAddedTo, dateAddedFromTime, dateAddedToTime]);

  const handleTagFilterClick = (tag: string) => {
    setSelectedTagFilters(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const clearTagFilters = () => {
    setSelectedTagFilters([]);
  };

  const clearEmailStatusFilter = () => {
    setEmailStatusFilter('all');
  };

  const handleCompanyClick = (company: Company, index: number) => {
    setSelectedCompany(company);
    setCurrentIndex(index);
  };

  const handleNavigate = (direction: 'prev' | 'next') => {
    const list = filteredCompanies ?? companies;
    if (!list?.length) return;
    
    const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex >= 0 && newIndex < list.length) {
      setCurrentIndex(newIndex);
      setSelectedCompany(list[newIndex]);
    }
  };

  const handleSendEmail = (company: Company) => {
    const primaryContact = company.contacts?.[0];
    if (primaryContact?.email) {
      setEmailRecipient({
        email: primaryContact.email,
        name: primaryContact.name,
        companyId: company.id,
        contactId: primaryContact.id,
      });
    } else if (company.general_email) {
      setEmailRecipient({
        email: company.general_email,
        name: company.name,
        companyId: company.id,
      });
    }
    setEmailDialogOpen(true);
  };

  const openGroupingOrBulkEmail = () => {
    const selectedCompanies = filteredCompanies?.filter(c => selectedCompanyIds.has(c.id)) || [];
    const companiesWithEmail = selectedCompanies.filter(company => {
      const match = getCompanyEmailContact(company);
      return !!match?.email;
    });
    if (companiesWithEmail.length === 0) {
      toast({
        title: "No emails available",
        description: "Selected companies don't have email addresses. Please extract emails first or add contacts.",
        variant: "destructive",
      });
      return;
    }
    setGroupingDialogCompanies(companiesWithEmail.map(c => ({
      id: c.id,
      name: c.name,
      industry: c.industry ?? undefined,
      tags: c.tags ?? undefined,
      description: c.description ?? undefined,
    })));
    setGroupingDialogOpen(true);
  };

  const openCreateGroupFromCompanies = () => {
    const selectedCompanies = filteredCompanies?.filter((c) => selectedCompanyIds.has(c.id)) || [];
    const companiesWithEmail = selectedCompanies.filter((company) => {
      const match = getCompanyEmailContact(company);
      return !!match?.email;
    });
    if (companiesWithEmail.length === 0) {
      toast({
        title: "No emails available",
        description: "Selected companies don't have email addresses. Extract emails or add contacts first.",
        variant: "destructive",
      });
      return;
    }
    setCreateGroupName("");
    setCreateGroupDescription("");
    setCreateGroupDialogOpen(true);
  };

  const handleCreateGroupFromCompanies = async () => {
    if (!createGroupName.trim()) {
      toast({ title: "Enter a group name", variant: "destructive" });
      return;
    }
    const selectedCompanies = filteredCompanies?.filter((c) => selectedCompanyIds.has(c.id)) || [];
    const companiesWithEmail = selectedCompanies.filter((company) => {
      const match = getCompanyEmailContact(company);
      return !!match?.email;
    });
    if (companiesWithEmail.length === 0) {
      toast({ title: "No companies with emails", variant: "destructive" });
      return;
    }
    setCreatingGroup(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const companyIds = companiesWithEmail.map((c) => c.id);
      const seen = new Set<string>();
      const members: Array<{ group_id: string; email: string; first_name: string | null; last_name: string | null; company: string | null; person_id: string | null }> = [];
      const { data: existingPeople } = await supabase
        .from("people")
        .select("id, first_name, last_name, email, company_id, companies(name)")
        .in("company_id", companyIds)
        .not("email", "is", null);
      if (existingPeople) {
        for (const p of existingPeople as any[]) {
          if (p.email && !seen.has(p.email.toLowerCase().trim())) {
            seen.add(p.email.toLowerCase().trim());
            members.push({
              group_id: "",
              email: p.email.trim().toLowerCase(),
              first_name: p.first_name || null,
              last_name: p.last_name || null,
              company: p.companies?.name || null,
              person_id: p.id,
            });
          }
        }
      }
      for (const company of companiesWithEmail) {
        const emailMatch = getCompanyEmailContact(company);
        if (emailMatch?.email && !seen.has(emailMatch.email.toLowerCase().trim())) {
          seen.add(emailMatch.email.toLowerCase().trim());
          const nameParts = emailMatch.type === "contact" && emailMatch.contact?.name ? emailMatch.contact.name.trim().split(" ") : company.name?.trim().split(" ") || [];
          members.push({
            group_id: "",
            email: emailMatch.email.trim().toLowerCase(),
            first_name: nameParts[0] || null,
            last_name: nameParts.length > 1 ? nameParts.slice(1).join(" ") : null,
            company: company.name || null,
            person_id: null,
          });
        }
      }
      if (members.length === 0) {
        toast({ title: "No recipients", description: "Could not resolve any email addresses.", variant: "destructive" });
        return;
      }
      const { data: group, error: groupError } = await supabase
        .from("recipient_groups")
        .insert({ user_id: user.id, name: createGroupName.trim(), description: createGroupDescription.trim() || null })
        .select("id")
        .single();
      if (groupError || !group) throw groupError || new Error("Failed to create group");
      const { error: membersError } = await supabase.from("recipient_group_members").insert(
        members.map((m) => ({ ...m, group_id: group.id }))
      );
      if (membersError) throw membersError;
      queryClient.invalidateQueries({ queryKey: ["recipient-groups"] });
      queryClient.invalidateQueries({ queryKey: ["recipient-groups-page"] });
      setCreateGroupDialogOpen(false);
      setCreateGroupName("");
      setCreateGroupDescription("");
      toast({ title: "Group created", description: `"${createGroupName.trim()}" has ${members.length} member(s). Use it in Newsletters or Campaigns.` });
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to create group", variant: "destructive" });
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleBulkEmailFromCompanies = async () => {
    // Use the companies from the grouping dialog (same 731 shown in the modal), not filteredCompanies/selectedCompanyIds,
    // which can be paginated or stale and would open compose with wrong count or fail.
    const companyIds = groupingDialogCompanies.map((c) => c.id);
    if (companyIds.length === 0) {
      toast({
        title: "No companies selected",
        description: "Select companies and try again.",
        variant: "destructive",
      });
      return;
    }
    await openBulkEmailForCompanyIds(companyIds);
  };

  const BULK_EMAIL_QUERY_BATCH = 200;

  const openBulkEmailForCompanyIds = async (companyIds: string[], mode: 'open' | 'add' | 'replace' = 'open') => {
    if (companyIds.length === 0) return;
    const loadingToast =
      companyIds.length > BULK_EMAIL_QUERY_BATCH
        ? toast({ title: "Opening campaign…", description: `Loading ${companyIds.length} companies. This may take a moment.` })
        : null;
    try {
      const companiesData: any[] = [];
      for (let i = 0; i < companyIds.length; i += BULK_EMAIL_QUERY_BATCH) {
        const batch = companyIds.slice(i, i + BULK_EMAIL_QUERY_BATCH);
        const { data, error: fetchErr } = await supabase
          .from("companies")
          .select("*, contacts(*)")
          .in("id", batch);
        if (fetchErr) throw fetchErr;
        if (data?.length) companiesData.push(...data);
      }
      const companies = companiesData as Company[];
      const companiesWithEmail = companies.filter((company) => {
        const match = getCompanyEmailContact(company);
        return !!match?.email;
      });
      if (companiesWithEmail.length === 0) {
        toast({
          title: "No emails available",
          description: "Selected companies don't have email addresses. Add contacts or send them to Enrichment Queue first.",
          variant: "destructive",
        });
        return;
      }
      const peopleForEmail: Array<{
        id: string;
        first_name: string;
        last_name: string;
        email: string;
        company_id?: string;
        companies?: { id?: string; name?: string; tags?: string[] };
      }> = [];
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const ids = companiesWithEmail.map((c) => c.id);
      const existingPeopleBatch: any[] = [];
      for (let i = 0; i < ids.length; i += BULK_EMAIL_QUERY_BATCH) {
        const batch = ids.slice(i, i + BULK_EMAIL_QUERY_BATCH);
        const { data } = await supabase
          .from("people")
          .select("id, first_name, last_name, email, company_id, companies(id, name, tags)")
          .in("company_id", batch)
          .not("email", "is", null);
        if (data?.length) existingPeopleBatch.push(...data);
      }
      const existingPeople = existingPeopleBatch.length ? existingPeopleBatch : null;
      const peopleByCompanyId = new Map<string, any[]>();
      if (existingPeople) {
        existingPeople.forEach((p: any) => {
          if (p.company_id) {
            if (!peopleByCompanyId.has(p.company_id)) peopleByCompanyId.set(p.company_id, []);
            peopleByCompanyId.get(p.company_id)!.push(p);
          }
        });
      }
      if (existingPeople) {
        peopleForEmail.push(
          ...existingPeople.map((p: any) => ({
            id: p.id,
            first_name: p.first_name || "",
            last_name: p.last_name || "",
            email: p.email,
            company_id: p.company_id,
            companies: p.companies ? { id: p.companies.id, name: p.companies.name, tags: p.companies.tags || [] } : undefined,
          }))
        );
      }
      const existingEmails = new Set(peopleForEmail.map((p) => p.email.toLowerCase().trim()));
      for (const company of companiesWithEmail) {
        // Carry EVERY contact email for the company (not just the first). A company
        // with multiple contacts must contribute one recipient per contact — this was
        // the "doesn't carry all leads" bug. Fall back to the general email only when
        // the company has no contacts with emails.
        const contactEmails = (company.contacts || [])
          .filter((c: any) => c?.email && String(c.email).trim())
          .map((c: any) => ({ email: String(c.email).trim(), name: (c.name || "").trim() }));
        const emailsToAdd = contactEmails.length > 0
          ? contactEmails
          : (company.general_email && String(company.general_email).trim()
              ? [{ email: String(company.general_email).trim(), name: "" }]
              : []);

        for (const { email, name } of emailsToAdd) {
          const norm = email.toLowerCase().trim();
          if (!norm || existingEmails.has(norm)) continue;
          const { data: existingPersonByEmail } = await supabase
            .from("people")
            .select("id, first_name, last_name, email, company_id, companies(id, name, tags)")
            .ilike("email", email)
            .maybeSingle();
          if (existingPersonByEmail) {
            if (!peopleForEmail.find((p) => p.id === existingPersonByEmail.id)) {
              peopleForEmail.push({
                id: existingPersonByEmail.id,
                first_name: existingPersonByEmail.first_name || "",
                last_name: existingPersonByEmail.last_name || "",
                email: existingPersonByEmail.email,
                company_id: company.id,
                companies: { id: company.id, name: company.name, tags: company.tags || [] },
              });
              existingEmails.add(existingPersonByEmail.email.toLowerCase().trim());
            }
          } else {
            const nameParts = name ? name.split(/\s+/) : company.name.trim().split(/\s+/);
            const { data: newPerson, error: createError } = await supabase
              .from("people")
              .insert({
                first_name: nameParts[0] || company.name,
                last_name: nameParts.slice(1).join(" ") || "",
                email,
                company_id: company.id,
                user_id: user.id,
              })
              .select("id, first_name, last_name, email, company_id")
              .single();
            if (!createError && newPerson) {
              peopleForEmail.push({
                id: newPerson.id,
                first_name: newPerson.first_name || "",
                last_name: newPerson.last_name || "",
                email: newPerson.email,
                company_id: newPerson.company_id,
                companies: { id: company.id, name: company.name, tags: company.tags || [] },
              });
              existingEmails.add(newPerson.email.toLowerCase().trim());
            }
          }
        }
      }
      if (peopleForEmail.length === 0) {
        toast({
          title: "No recipients found",
          description: "Could not find email addresses for selected companies.",
          variant: "destructive",
        });
        return;
      }
      const totalCompanies = companyIds.length;
      const withEmail = companiesWithEmail.length;
      if (peopleForEmail.length < totalCompanies) {
        toast({
          title: "Campaign opened with partial list",
          description: `${peopleForEmail.length} recipient${peopleForEmail.length === 1 ? "" : "s"} from ${withEmail} companies that had email. ${totalCompanies - withEmail} companies had no email — add company email or contacts in Companies to include them.`,
          variant: "default",
        });
      } else {
        toast({
          title: "Campaign opened",
          description: `${peopleForEmail.length} recipient${peopleForEmail.length === 1 ? "" : "s"} from ${totalCompanies} companies.`,
        });
      }
      const companiesOverviewBatch: any[] = [];
      for (let i = 0; i < ids.length; i += BULK_EMAIL_QUERY_BATCH) {
        const batch = ids.slice(i, i + BULK_EMAIL_QUERY_BATCH);
        const { data } = await supabase
          .from("companies")
          .select("id, name, description, industry, website, enrichment_data, recent_news, funding_stage, funding_total, employee_count, tech_stack, key_executives, tags")
          .in("id", batch);
        if (data?.length) companiesOverviewBatch.push(...data);
      }
      const companiesOverview = companiesOverviewBatch.length ? companiesOverviewBatch : undefined;
      const enrichedPeople = peopleForEmail.map((person) => {
        const companyData = companiesOverview?.find((c) => c.id === person.company_id);
        if (companyData) {
          const fundingTotal =
            typeof companyData.funding_total === "string"
              ? parseFloat(companyData.funding_total) || undefined
              : typeof companyData.funding_total === "number"
                ? companyData.funding_total
                : undefined;
          return {
            id: person.id,
            first_name: person.first_name,
            last_name: person.last_name,
            email: person.email,
            company_id: person.company_id,
            companies: {
              id: companyData.id,
              name: companyData.name,
              tags: companyData.tags || [],
              description: companyData.description,
              industry: companyData.industry,
              website: companyData.website,
              enrichment_data: companyData.enrichment_data,
              recent_news: companyData.recent_news,
              funding_stage: companyData.funding_stage,
              funding_total: fundingTotal,
              employee_count: companyData.employee_count,
              tech_stack: Array.isArray(companyData.tech_stack) ? companyData.tech_stack : undefined,
              key_executives: Array.isArray(companyData.key_executives) ? (companyData.key_executives as any[]) : undefined,
            },
          };
        }
        return { id: person.id, first_name: person.first_name, last_name: person.last_name, email: person.email, company_id: person.company_id, companies: person.companies };
      });
      // Dedupe by email so no duplicate is sent (keep first occurrence)
      const seenEmails = new Set<string>();
      const dedupedPeople = enrichedPeople.filter((p) => {
        const e = p.email?.toLowerCase().trim();
        if (!e) return false;
        if (seenEmails.has(e)) return false;
        seenEmails.add(e);
        return true;
      });
      if (dedupedPeople.length < enrichedPeople.length) {
        toast({
          title: "Duplicates removed",
          description: `${enrichedPeople.length - dedupedPeople.length} duplicate email${enrichedPeople.length - dedupedPeople.length === 1 ? "" : "s"} removed. ${dedupedPeople.length} unique recipient${dedupedPeople.length === 1 ? "" : "s"}.`,
          variant: "default",
        });
      }
      if (mode === 'add') {
        addPeople(dedupedPeople as any);
      } else {
        openWithPeople(dedupedPeople as any);
      }
      if (loadingToast) loadingToast.dismiss();
    } catch (error: any) {
      if (loadingToast) loadingToast.dismiss();
      toast({
        title: "Error",
        description: error.message || "Failed to open bulk email",
        variant: "destructive",
      });
    }
  };

  const handleAddToContactList = (company: Company) => {
    const emailMatch = getCompanyEmailContact(company);
    
    // Prepare initial values from company information
    let firstName = "";
    let lastName = "";
    
    if (emailMatch?.type === "contact" && emailMatch.contact?.name) {
      const nameParts = emailMatch.contact.name.trim().split(" ");
      firstName = nameParts[0] || "";
      lastName = nameParts.slice(1).join(" ") || "";
    } else if (emailMatch?.email) {
      // If we have an email but no contact name, leave name empty for user to fill
      firstName = "";
      lastName = "";
    } else {
      // No email available - leave name empty
      firstName = "";
      lastName = "";
    }

    // Get phone from contact or company (check both snake_case and camelCase)
    const companyPhone = (company as any).company_phone || (company as any).companyPhone || "";
    const companyLinkedIn = (company as any).linkedin_url || (company as any).linkedinUrl || "";

    // Compute initial values
    const initialValues = {
      first_name: firstName,
      last_name: lastName,
      email: emailMatch?.email || "",
      phone: emailMatch?.contact?.phone || companyPhone || "",
      title: emailMatch?.contact?.title || "",
      company_id: company.id,
      company_name: company.name,
      linkedin_url: emailMatch?.contact?.linkedin_url || companyLinkedIn || "",
    };

    setCompanyForContact(company);
    setContactInitialValues(initialValues);
    setAddContactDialogOpen(true);
  };

  if (isLoading && !hasServerFilters) {
    return <div className="flex items-center justify-center h-96">Loading...</div>;
  }

  return (
    <div className="space-y-4 md:space-y-6 pt-12 lg:pt-0">
      {/* Tag Migration Alert */}
      {showTagMigrationPrompt && (
        <Card className="mx-4 md:mx-0 border-blue-200 bg-blue-50 dark:bg-blue-950/30">
          <CardContent className="py-4 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Wand2 className="h-5 w-5 text-blue-600" />
                <div>
                  <h4 className="font-semibold text-sm">Intelligent Tags Available</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Your companies have intelligent tags in enrichment data that need to be applied for filtering to work.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    migrateTagsMutation.mutate();
                    setShowTagMigrationPrompt(false);
                  }}
                  disabled={migrateTagsMutation.isPending}
                >
                  {migrateTagsMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      Applying...
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4 mr-1" />
                      Apply Tags Now
                    </>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowTagMigrationPrompt(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 md:px-0">
        <div>
          <h1 className="text-2xl md:text-4xl font-bold tracking-tight">Companies</h1>
          <p className="text-muted-foreground mt-1 md:mt-2 text-sm md:text-base flex items-center gap-2 flex-wrap">
            {hasServerFilters && isLoadingFiltered && (
              <span className="inline-flex items-center gap-1.5 text-primary">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Applying filters to all companies…
              </span>
            )}
            {filteredCompanies?.length ?? 0} of {companiesTotalCount ?? baseCompanies?.length ?? 0} companies
            {(selectedTagFilters.length > 0 || emailStatusFilter !== 'all' || sentInFilter !== 'all' || selectedCampaignTagFilters.length > 0 || searchQuery.trim() || dateAddedPreset !== 'all' || dateAddedFrom || dateAddedTo) && " (filtered)"}
          </p>
          <p className="text-muted-foreground/80 text-xs mt-0.5">
            Search and filters apply to all companies. Use &quot;Select all filtered&quot; to select every matching company for bulk email.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Search Input */}
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by name, industry, or group/category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-full sm:w-64"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          
          {/* Email Status Filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Mail className="h-4 w-4" />
                Email Status
                {emailStatusFilter !== 'all' && (
                  <Badge variant="secondary" className="ml-1">
                    1
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56" align="end">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm">Filter by Email Status</h4>
                  {emailStatusFilter !== 'all' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={clearEmailStatusFilter}
                    >
                      Clear
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="filter-email-all"
                      checked={emailStatusFilter === 'all'}
                      onCheckedChange={() => setEmailStatusFilter('all')}
                    />
                    <label
                      htmlFor="filter-email-all"
                      className="text-sm cursor-pointer flex-1 flex items-center gap-2"
                    >
                      <span>All Companies</span>
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="filter-email-has"
                      checked={emailStatusFilter === 'has-email'}
                      onCheckedChange={() => setEmailStatusFilter('has-email')}
                    />
                    <label
                      htmlFor="filter-email-has"
                      className="text-sm cursor-pointer flex-1 flex items-center gap-2"
                    >
                      <Mail className="h-3.5 w-3.5 text-green-600" />
                      <span>Has Email</span>
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="filter-email-phone"
                      checked={emailStatusFilter === 'has-email-and-phone'}
                      onCheckedChange={() => setEmailStatusFilter('has-email-and-phone')}
                    />
                    <label
                      htmlFor="filter-email-phone"
                      className="text-sm cursor-pointer flex-1 flex items-center gap-2"
                    >
                      <Phone className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Has Email & Phone</span>
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="filter-email-has-not-contacts"
                      checked={emailStatusFilter === 'has-email-not-in-contacts'}
                      onCheckedChange={() => setEmailStatusFilter('has-email-not-in-contacts')}
                    />
                    <label
                      htmlFor="filter-email-has-not-contacts"
                      className="text-sm cursor-pointer flex-1 flex items-center gap-2"
                    >
                      <Mail className="h-3.5 w-3.5 text-amber-600" />
                      <span>Has Email (Not in Contacts)</span>
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="filter-email-contacts"
                      checked={emailStatusFilter === 'in-contacts'}
                      onCheckedChange={() => setEmailStatusFilter('in-contacts')}
                    />
                    <label
                      htmlFor="filter-email-contacts"
                      className="text-sm cursor-pointer flex-1 flex items-center gap-2"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" />
                      <span>Added to Contacts</span>
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="filter-email-none"
                      checked={emailStatusFilter === 'no-email'}
                      onCheckedChange={() => setEmailStatusFilter('no-email')}
                    />
                    <label
                      htmlFor="filter-email-none"
                      className="text-sm cursor-pointer flex-1 flex items-center gap-2"
                    >
                      <X className="h-3.5 w-3.5 text-red-600" />
                      <span>No Email</span>
                    </label>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Tag Filter - Enhanced with TagInput */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="h-4 w-4" />
                Filter by Tags
                {selectedTagFilters.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {selectedTagFilters.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm">Filter by Tags</h4>
                  {selectedTagFilters.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => setSelectedTagFilters([])}
                    >
                      Clear all
                    </Button>
                  )}
                </div>
                <TagInput
                  tags={selectedTagFilters}
                  onTagsChange={setSelectedTagFilters}
                  suggestions={combinedSuggestions}
                  placeholder="Type to search tags (e.g., translation service, healthcare, post office)..."
                  maxTags={50}
                  showAddButton={false}
                />
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    {combinedSuggestions.length} tags available ({Array.from(allCompanyTagsFromData).length} intelligent tags from your companies). Select multiple tags to filter.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => migrateTagsMutation.mutate()}
                    disabled={migrateTagsMutation.isPending}
                  >
                    {migrateTagsMutation.isPending ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Applying Tags...
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-3 w-3 mr-1" />
                        Apply Intelligent Tags to Companies
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    This will migrate tags from enrichment data to make filtering work properly.
                  </p>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          {/* Sent in campaign/newsletter filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Send className="h-4 w-4" />
                Sent in
                {sentInFilter !== 'all' && (
                  <Badge variant="secondary" className="ml-1">1</Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56" align="end">
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Filter by outreach</h4>
                <p className="text-xs text-muted-foreground">Show companies/contacts already sent a campaign or newsletter.</p>
                <Button
                  variant={sentInFilter === 'all' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setSentInFilter('all')}
                >
                  All
                </Button>
                <Button
                  variant={sentInFilter === 'sent-campaign' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setSentInFilter('sent-campaign')}
                >
                  <Send className="h-3.5 w-3.5 mr-2 text-primary" />
                  Sent in campaign
                </Button>
                <Button
                  variant={sentInFilter === 'sent-newsletter' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setSentInFilter('sent-newsletter')}
                >
                  <Megaphone className="h-3.5 w-3.5 mr-2 text-primary" />
                  Sent in newsletter
                </Button>
                <Button
                  variant={sentInFilter === 'not-sent' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setSentInFilter('not-sent')}
                >
                  Not sent (campaign or newsletter)
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Campaign/Newsletter tags filter */}
          {allCampaignTagsFromCampaigns.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Megaphone className="h-4 w-4" />
                  Campaign tags
                  {selectedCampaignTagFilters.length > 0 && (
                    <Badge variant="secondary" className="ml-1">{selectedCampaignTagFilters.length}</Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 max-h-[280px] overflow-y-auto" align="end">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Filter by campaign/newsletter tag</h4>
                  <p className="text-xs text-muted-foreground">Show companies sent in a campaign with any of these tags.</p>
                  {selectedCampaignTagFilters.length > 0 && (
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setSelectedCampaignTagFilters([])}>
                      Clear all
                    </Button>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {allCampaignTagsFromCampaigns.map((tag) => (
                      <Badge
                        key={tag}
                        variant={selectedCampaignTagFilters.includes(tag) ? 'default' : 'outline'}
                        className="cursor-pointer text-xs"
                        onClick={() => setSelectedCampaignTagFilters(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}

          {/* Source filter: group companies by where they were added from */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Building2 className="h-4 w-4" />
                Source
                {sourceFilter && (
                  <Badge variant="secondary" className="ml-1">{sourceFilter}</Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56" align="end">
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Filter by source</h4>
                <Button
                  variant={sourceFilter === null ? "secondary" : "ghost"}
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setSourceFilter(null)}
                >
                  All sources
                </Button>
                {SOURCE_TAG_LIST.map((label) => (
                  <Button
                    key={label}
                    variant={sourceFilter === label ? "secondary" : "ghost"}
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => setSourceFilter(label)}
                  >
                    {label}
                  </Button>
                ))}
                <div className="pt-2 border-t">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={groupBySource}
                      onCheckedChange={(v) => setGroupBySource(!!v)}
                    />
                    Group by source
                  </label>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          {/* Date added filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <CalendarDays className="h-4 w-4" />
                Date added
                {(dateAddedPreset !== 'all' || dateAddedFrom || dateAddedTo) && (
                  <Badge variant="secondary" className="ml-1">1</Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="end">
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Filter by date added</h4>
                <Button
                  variant={dateAddedPreset === 'all' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => { setDateAddedPreset('all'); setDateAddedFrom(''); setDateAddedTo(''); setDateAddedFromTime(''); setDateAddedToTime(''); }}
                >
                  All time
                </Button>
                <Button
                  variant={dateAddedPreset === 'today' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setDateAddedPreset('today')}
                >
                  Today
                </Button>
                <Button
                  variant={dateAddedPreset === 'yesterday' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setDateAddedPreset('yesterday')}
                >
                  Yesterday
                </Button>
                <Button
                  variant={dateAddedPreset === 'last7' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setDateAddedPreset('last7')}
                >
                  Last 7 days
                </Button>
                <Button
                  variant={dateAddedPreset === 'last30' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setDateAddedPreset('last30')}
                >
                  Last 30 days
                </Button>
                <Button
                  variant={dateAddedPreset === 'last90' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setDateAddedPreset('last90')}
                >
                  Last 90 days
                </Button>
                {(dateAddedPreset === 'today' || dateAddedPreset === 'yesterday') && (
                  <div className="pt-2 border-t space-y-2">
                    <p className="text-xs text-muted-foreground">Time range (optional)</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">From</Label>
                        <TimePicker
                          value={dateAddedFromTime}
                          onChange={setDateAddedFromTime}
                          className="w-full text-xs"
                          aria-label="Time from"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">To</Label>
                        <TimePicker
                          value={dateAddedToTime}
                          onChange={setDateAddedToTime}
                          className="w-full text-xs"
                          aria-label="Time to"
                        />
                      </div>
                    </div>
                  </div>
                )}
                <div className="pt-2 border-t space-y-2">
                  <p className="text-xs text-muted-foreground">Custom range</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="h-9 w-full justify-start text-left font-normal text-xs"
                        >
                          <CalendarDays className="mr-2 h-3.5 w-3.5" />
                          {dateAddedFrom ? format(new Date(dateAddedFrom + "T00:00:00"), "MMM d, yyyy") : "From date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dateAddedFrom ? new Date(dateAddedFrom + "T12:00:00") : undefined}
                          onSelect={(d) => {
                            setDateAddedFrom(d ? format(d, "yyyy-MM-dd") : "");
                            setDateAddedPreset("custom");
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="h-9 w-full justify-start text-left font-normal text-xs"
                        >
                          <CalendarDays className="mr-2 h-3.5 w-3.5" />
                          {dateAddedTo ? format(new Date(dateAddedTo + "T00:00:00"), "MMM d, yyyy") : "To date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dateAddedTo ? new Date(dateAddedTo + "T12:00:00") : undefined}
                          onSelect={(d) => {
                            setDateAddedTo(d ? format(d, "yyyy-MM-dd") : "");
                            setDateAddedPreset("custom");
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  {(dateAddedPreset === 'custom') && (dateAddedFrom || dateAddedTo) && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">From time</Label>
                        <TimePicker
                          value={dateAddedFromTime}
                          onChange={setDateAddedFromTime}
                          className="w-full text-xs"
                          aria-label="Time from"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">To time</Label>
                        <TimePicker
                          value={dateAddedToTime}
                          onChange={setDateAddedToTime}
                          className="w-full text-xs"
                          aria-label="Time to"
                        />
                      </div>
                    </div>
                  )}
                  {(dateAddedFrom || dateAddedTo) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => { setDateAddedFrom(''); setDateAddedTo(''); setDateAddedPreset('all'); setDateAddedFromTime(''); setDateAddedToTime(''); }}
                    >
                      Clear range
                    </Button>
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <CampaignFitAnalyzer onOpenBulkEmail={openBulkEmailForCompanyIds} />
          <Button onClick={() => setCsvUploaderOpen(true)} variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
          <Button onClick={() => setScraperDialogOpen(true)} className="gap-2">
            <Sparkles className="h-4 w-4" />
            Scrape Google
          </Button>
        </div>
      </div>

      {/* Active Filters */}
      {(selectedTagFilters.length > 0 || emailStatusFilter !== 'all' || sentInFilter !== 'all' || selectedCampaignTagFilters.length > 0 || sourceFilter || dateAddedPreset !== 'all' || dateAddedFrom || dateAddedTo) && (
        <div className="flex flex-wrap gap-2 px-4 md:px-0 items-center">
          <span className="text-sm text-muted-foreground">Filtering by:</span>
          {sentInFilter !== 'all' && (
            <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={() => setSentInFilter('all')}>
              {sentInFilter === 'sent-campaign' && <><Send className="h-3 w-3" /> Sent in campaign</>}
              {sentInFilter === 'sent-newsletter' && <><Megaphone className="h-3 w-3" /> Sent in newsletter</>}
              {sentInFilter === 'not-sent' && 'Not sent'}
              <X className="h-3 w-3 ml-1" />
            </Badge>
          )}
          {selectedCampaignTagFilters.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1 cursor-pointer" onClick={() => setSelectedCampaignTagFilters(prev => prev.filter(t => t !== tag))}>
              <Megaphone className="h-3 w-3" /> {tag}
              <X className="h-3 w-3 ml-1" />
            </Badge>
          ))}
{(dateAddedPreset !== 'all' || dateAddedFrom || dateAddedTo) && (
                <Badge
                  variant="secondary"
                  className="gap-1 cursor-pointer"
                  onClick={() => { setDateAddedPreset('all'); setDateAddedFrom(''); setDateAddedTo(''); setDateAddedFromTime(''); setDateAddedToTime(''); }}
                >
                  <CalendarDays className="h-3 w-3" />
                  {dateAddedPreset === 'today' && 'Today'}
                  {dateAddedPreset === 'yesterday' && 'Yesterday'}
                  {dateAddedPreset === 'last7' && 'Last 7 days'}
                  {dateAddedPreset === 'last30' && 'Last 30 days'}
                  {dateAddedPreset === 'last90' && 'Last 90 days'}
                  {dateAddedPreset === 'custom' && (dateAddedFrom || dateAddedTo) && `${dateAddedFrom || '…'} to ${dateAddedTo || '…'}`}
                  {(dateAddedFromTime || dateAddedToTime) && ` ${dateAddedFromTime || ''}–${dateAddedToTime || ''}`}
                  <X className="h-3 w-3 ml-1" />
                </Badge>
              )}
          {sourceFilter && (
            <Badge
              variant="secondary"
              className="gap-1 cursor-pointer"
              onClick={() => setSourceFilter(null)}
            >
              Source: {sourceFilter}
              <X className="h-3 w-3 ml-1" />
            </Badge>
          )}
          {emailStatusFilter !== 'all' && (
            <Badge
              variant="secondary"
              className="gap-1 cursor-pointer"
              onClick={clearEmailStatusFilter}
            >
              {emailStatusFilter === 'has-email' && (
                <>
                  <Mail className="h-3 w-3 text-green-600" />
                  Has Email
                </>
              )}
              {emailStatusFilter === 'has-email-not-in-contacts' && (
                <>
                  <Mail className="h-3 w-3 text-amber-600" />
                  Has Email (Not in Contacts)
                </>
              )}
              {emailStatusFilter === 'in-contacts' && (
                <>
                  <CheckCircle2 className="h-3 w-3 text-blue-600" />
                  Added to Contacts
                </>
              )}
              {emailStatusFilter === 'has-email-and-phone' && (
                <>
                  <Phone className="h-3 w-3 text-emerald-600" />
                  Has Email & Phone
                </>
              )}
              {emailStatusFilter === 'no-email' && (
                <>
                  <X className="h-3 w-3 text-red-600" />
                  No Email
                </>
              )}
              <X className="h-3 w-3 ml-1" />
            </Badge>
          )}
          {selectedTagFilters.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="gap-1 cursor-pointer"
              onClick={() => handleTagFilterClick(tag)}
            >
              {tag}
              <X className="h-3 w-3" />
            </Badge>
          ))}
        </div>
      )}

      {filteredCompanies && filteredCompanies.length > 0 && (
        <div className="px-4 md:px-0">
          <ProspectAnalyzer 
            companies={filteredCompanies} 
            onAnalysisComplete={() => {
              queryClient.invalidateQueries({ queryKey: ["companies-full"] });
              queryClient.invalidateQueries({ queryKey: ["companies-total-count"] });
            }}
          />
        </div>
      )}

      {/* Bulk Actions Bar */}
      {selectedCompanyIds.size > 0 && (
        <div className="sticky top-0 z-10 mx-4 md:mx-0 space-y-2">
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="flex items-center justify-between py-3 px-4">
              <span className="text-sm font-medium">
                {selectedCompanyIds.size} compan{selectedCompanyIds.size !== 1 ? 'ies' : 'y'} selected
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedCompanyIds(new Set())}
                  disabled={bulkExtractEmailMutation.isPending}
                >
                  Clear Selection
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setBulkDeleteDialogOpen(true)}
                  disabled={bulkExtractEmailMutation.isPending || bulkDeleteMutation.isPending}
                >
                  {bulkDeleteMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-1" />
                  )}
                  Delete ({selectedCompanyIds.size})
                </Button>
                {(() => {
                  const selectedCompanies = filteredCompanies?.filter(c => selectedCompanyIds.has(c.id)) || [];
                  const hasEmail = (company: typeof selectedCompanies[0]) =>
                    !!(company.general_email || (company as any).generalEmail || company.contacts?.some((c: any) => c.email));
                  const hasPhone = (company: typeof selectedCompanies[0]) =>
                    !!((company as any).company_phone || (company as any).companyPhone || company.contacts?.some((c: any) => c.phone));
                  const companiesWithoutEmail = selectedCompanies.filter(company => {
                    const website = company.website?.trim() || '';
                    const hasValidWebsite = website &&
                                            !website.startsWith('no-website-') &&
                                            website.length > 3 &&
                                            (website.startsWith('http://') ||
                                             website.startsWith('https://') ||
                                             website.includes('.') && !website.includes(' '));
                    return !hasEmail(company) && hasValidWebsite;
                  });
                  const companiesMissingEmailOrPhone = selectedCompanies.filter(
                    company => !hasEmail(company) && !hasPhone(company)
                  );
                  const companiesWithEmail = selectedCompanies.filter(company => {
                    const match = getCompanyEmailContact(company);
                    return !!match?.email;
                  });
                  const companiesNotInContacts = companiesWithEmail.filter(company => !isCompanyInContacts(company));
                  
                  return (
                    <>
                      {companiesWithoutEmail.length > 0 && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => bulkExtractEmailMutation.mutate(Array.from(selectedCompanyIds))}
                          disabled={bulkExtractEmailMutation.isPending}
                        >
                          {bulkExtractEmailMutation.isPending ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              Extracting...
                            </>
                          ) : (
                            <>
                              <Wand2 className="h-4 w-4 mr-1" />
                              Extract Emails ({companiesWithoutEmail.length})
                            </>
                          )}
                        </Button>
                      )}
                      {companiesMissingEmailOrPhone.length > 0 && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => addToEnrichmentMutation.mutate(companiesMissingEmailOrPhone.map(c => c.id))}
                          disabled={addToEnrichmentMutation.isPending}
                          title="Add only companies that have no email and no phone to the Enrichment queue"
                        >
                          {addToEnrichmentMutation.isPending ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              Adding...
                            </>
                          ) : (
                            <>
                              <Wand2 className="h-4 w-4 mr-1" />
                              Add to Enrichment – missing email/phone ({companiesMissingEmailOrPhone.length})
                            </>
                          )}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addToEnrichmentMutation.mutate(Array.from(selectedCompanyIds))}
                        disabled={addToEnrichmentMutation.isPending}
                        title="Add all selected companies to the Enrichment queue"
                      >
                        {addToEnrichmentMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            Adding...
                          </>
                        ) : (
                          <>
                            <Wand2 className="h-4 w-4 mr-1" />
                            Add to Enrichment – all ({selectedCompanies.length})
                          </>
                        )}
                      </Button>
                      {companiesNotInContacts.length > 0 && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => bulkAddToContactsMutation.mutate(Array.from(selectedCompanyIds))}
                          disabled={bulkAddToContactsMutation.isPending}
                        >
                          {bulkAddToContactsMutation.isPending ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              Adding...
                            </>
                          ) : (
                            <>
                              <UserPlus className="h-4 w-4 mr-1" />
                              Add to Contacts ({companiesNotInContacts.length})
                            </>
                          )}
                        </Button>
                      )}
                      {companiesWithEmail.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={openCreateGroupFromCompanies}
                          disabled={bulkExtractEmailMutation.isPending}
                          title="Save selected companies as a recipient group for newsletters and campaigns"
                        >
                          <FolderPlus className="h-4 w-4 mr-1" />
                          Create group ({companiesWithEmail.length})
                        </Button>
                      )}
                      {/* When campaign dialog is open (context) or opened as popup: prioritize Add/Replace */}
                      {(bulkEmailDialogOpen || openedFromDraft) ? (
                        <>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => {
                              if (companiesWithEmail.length === 0) return;
                              const companyIds = companiesWithEmail.map(c => c.id);
                              if (bulkEmailDialogOpen) {
                                // Direct context integration — no popup/postMessage needed
                                openBulkEmailForCompanyIds(companyIds, 'add');
                              } else {
                                try {
                                  localStorage.removeItem('leadboosters_draft_recipients');
                                  localStorage.removeItem('leadboosters_selected_people_ids');
                                  sessionStorage.setItem('leadboosters_selected_company_ids', JSON.stringify(companyIds));
                                  window.opener?.postMessage?.(
                                    { type: "LEADGENIE_ADD_RECIPIENTS_TO_DRAFT" },
                                    window.location.origin
                                  );
                                  toast({ title: "Added to campaign", description: "Return to the campaign tab to see the updated recipient list." });
                                } catch {
                                  toast({ title: "Could not reach campaign tab", variant: "destructive" });
                                }
                              }
                            }}
                            disabled={companiesWithEmail.length === 0}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add to campaign ({companiesWithEmail.length})
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => {
                              if (companiesWithEmail.length === 0) return;
                              const companyIds = companiesWithEmail.map(c => c.id);
                              if (bulkEmailDialogOpen) {
                                // Direct context integration — replaces recipient list
                                openBulkEmailForCompanyIds(companyIds, 'replace');
                              } else {
                                try {
                                  localStorage.removeItem('leadboosters_draft_recipients');
                                  localStorage.removeItem('leadboosters_selected_people_ids');
                                  sessionStorage.setItem('leadboosters_selected_company_ids', JSON.stringify(companyIds));
                                  window.opener?.postMessage?.(
                                    { type: "LEADGENIE_REPLACE_RECIPIENTS_TO_DRAFT" },
                                    window.location.origin
                                  );
                                  toast({ title: "Campaign list replaced", description: "Return to the campaign tab to see the updated recipient list." });
                                } catch {
                                  toast({ title: "Could not reach campaign tab", variant: "destructive" });
                                }
                              }
                            }}
                            disabled={companiesWithEmail.length === 0}
                          >
                            <RefreshCw className="h-4 w-4 mr-1" />
                            Replace campaign list
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={openGroupingOrBulkEmail}
                            disabled={bulkExtractEmailMutation.isPending}
                          >
                            <Mail className="h-4 w-4 mr-1" />
                            {companiesWithEmail.length > 0 ? `Send new campaign (${companiesWithEmail.length})` : "Send new campaign"}
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant={companiesWithEmail.length > 0 ? "default" : "outline"}
                            size="sm"
                            onClick={openGroupingOrBulkEmail}
                            disabled={bulkExtractEmailMutation.isPending}
                          >
                            <Mail className="h-4 w-4 mr-1" />
                            {companiesWithEmail.length > 0 ? `Send Bulk Email (${companiesWithEmail.length})` : "Send Bulk Email"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              if (companiesWithEmail.length === 0) return;
                              try {
                                toast({ title: "Preparing recipients…", description: "Resolving email addresses for selected companies." });
                                const companyIds = companiesWithEmail.map(c => c.id);
                                const { data: { user } } = await supabase.auth.getUser();
                                if (!user) throw new Error('Not authenticated');
                                const prepared: Array<{ id: string; first_name: string; last_name: string; email: string; company_id?: string; companies?: { id?: string; name?: string; tags?: string[] } }> = [];
                                const seen = new Set<string>();
                                const { data: existingPeople } = await supabase
                                  .from('people')
                                  .select('id, first_name, last_name, email, company_id, companies(id, name, tags)')
                                  .in('company_id', companyIds)
                                  .not('email', 'is', null);
                                if (existingPeople) {
                                  for (const p of existingPeople as any[]) {
                                    if (p.email && !seen.has(p.email.toLowerCase().trim())) {
                                      seen.add(p.email.toLowerCase().trim());
                                      prepared.push({ id: p.id, first_name: p.first_name ?? '', last_name: p.last_name ?? '', email: p.email, company_id: p.company_id, companies: p.companies });
                                    }
                                  }
                                }
                                for (const company of companiesWithEmail) {
                                  const emailMatch = getCompanyEmailContact(company);
                                  if (emailMatch?.email && !seen.has(emailMatch.email.toLowerCase().trim())) {
                                    const { data: existPerson } = await supabase.from('people').select('id, first_name, last_name, email, company_id, companies(id, name, tags)').ilike('email', emailMatch.email).maybeSingle();
                                    if (existPerson) {
                                      if (existPerson.company_id !== company.id) await supabase.from('people').update({ company_id: company.id }).eq('id', existPerson.id);
                                      seen.add(existPerson.email.toLowerCase().trim());
                                      prepared.push({ id: existPerson.id, first_name: existPerson.first_name ?? '', last_name: existPerson.last_name ?? '', email: existPerson.email, company_id: company.id, companies: existPerson.companies ?? { id: company.id, name: company.name, tags: company.tags || [] } });
                                    } else {
                                      const nameParts = emailMatch.type === 'contact' && emailMatch.contact?.name ? emailMatch.contact.name.trim().split(' ') : company.name.trim().split(' ');
                                      const { data: newP } = await supabase.from('people').insert({ first_name: nameParts[0] || company.name, last_name: nameParts.slice(1).join(' ') || '', email: emailMatch.email, company_id: company.id, user_id: user.id }).select('id, first_name, last_name, email, company_id').single();
                                      if (newP) {
                                        seen.add(newP.email.toLowerCase().trim());
                                        prepared.push({ id: newP.id, first_name: newP.first_name ?? '', last_name: newP.last_name ?? '', email: newP.email, company_id: newP.company_id, companies: { id: company.id, name: company.name, tags: company.tags || [] } });
                                      }
                                    }
                                  }
                                }
                                localStorage.setItem('leadboosters_draft_recipients', JSON.stringify(prepared));
                                navigate("/campaigns?tab=drafts", { state: { addToDraft: true } });
                              } catch (e: any) {
                                toast({ title: "Error preparing recipients", description: e?.message ?? "Please try again", variant: "destructive" });
                              }
                            }}
                            disabled={companiesWithEmail.length === 0}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add to draft
                          </Button>
                        </>
                      )}
                    </>
                  );
                })()}
              </div>
            </CardContent>
          </Card>

          {/* Extraction Progress */}
          {extractionProgress.status === 'extracting' && (
            <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/30">
              <CardContent className="py-3 px-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-600 flex-shrink-0" />
                      <span className="font-medium truncate">
                        Processing: {extractionProgress.currentCompany || 'Starting...'}
                      </span>
                    </div>
                    <span className="text-muted-foreground flex-shrink-0 ml-2">
                      {extractionProgress.current} / {extractionProgress.total}
                    </span>
                  </div>
                  <Progress 
                    value={extractionProgress.total > 0 ? (extractionProgress.current / extractionProgress.total) * 100 : 0} 
                    className="h-2"
                  />
                  <div className="flex items-center gap-4 text-xs flex-wrap">
                    <span className="flex items-center gap-1.5 text-green-700 dark:text-green-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span className="font-medium">{extractionProgress.extracted}</span>
                      <span className="text-muted-foreground">extracted</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-red-700 dark:text-red-400">
                      <X className="h-3.5 w-3.5" />
                      <span className="font-medium">{extractionProgress.failed}</span>
                      <span className="text-muted-foreground">no email found</span>
                    </span>
                    {extractionProgress.total > 0 && (
                      <span className="text-muted-foreground ml-auto">
                        {Math.round((extractionProgress.current / extractionProgress.total) * 100)}% complete
                      </span>
                    )}
                  </div>
                  {extractionProgress.currentCompany && (
                    <div className="text-xs text-muted-foreground pt-1 border-t">
                      Currently extracting from: <span className="font-medium">{extractionProgress.currentCompany}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Pagination + Select: at top so visible without scrolling */}
      {filteredCompanies && filteredCompanies.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 px-4 md:px-0 py-3 border-b">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Per page</span>
              <Select
                value={String(companiesPageSize)}
                onValueChange={(v) => {
                  setCompaniesPageSize(Number(v));
                  setCompaniesPage(1);
                }}
              >
                <SelectTrigger className="w-24 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="200">200</SelectItem>
                  <SelectItem value="500">500</SelectItem>
                  <SelectItem value="1000">1000</SelectItem>
                  <SelectItem value="2000">2000</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {totalCompaniesPages > 1 && (
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => { e.preventDefault(); if (companiesPage > 1) setCompaniesPage(p => p - 1); }}
                      className={companiesPage <= 1 ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <span className="px-4 py-2 text-sm">
                      Page {companiesPage} of {totalCompaniesPages}
                    </span>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => { e.preventDefault(); if (companiesPage < totalCompaniesPages) setCompaniesPage(p => p + 1); }}
                      className={companiesPage >= totalCompaniesPages ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </div>
        </div>
      )}

      {/* Select All Header */}
      {filteredCompanies && filteredCompanies.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 px-4 md:px-0">
          <Checkbox
            checked={paginatedCompanies.length > 0 && paginatedCompanies.every(c => selectedCompanyIds.has(c.id))}
            onCheckedChange={toggleSelectAll}
          />
          <span className="text-sm text-muted-foreground">
            {paginatedCompanies.every(c => selectedCompanyIds.has(c.id)) && paginatedCompanies.length > 0 ? 'Deselect page' : 'Select page'}
          </span>
          <span className="text-xs text-muted-foreground">
            ({(companiesPage - 1) * companiesPageSize + 1}–{Math.min(companiesPage * companiesPageSize, filteredCompanies!.length)} of {filteredCompanies!.length})
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto py-1 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={toggleSelectAllFiltered}
          >
            {filteredCompanies!.length > 0 && [...filteredCompanies].every(c => selectedCompanyIds.has(c.id))
              ? 'Deselect all filtered'
              : `Select all filtered (${filteredCompanies!.length})`}
          </Button>
        </div>
      )}

      <div className="space-y-3 px-4 md:px-0 max-h-[calc(100vh-16rem)] overflow-y-auto">
        {(groupBySource && companiesGroupedBySource?.length
          ? companiesGroupedBySource.flatMap(({ label, companies: sectionCompanies }) => [
              { _type: 'header' as const, key: `header-${label}`, label, count: sectionCompanies.length, companyIds: sectionCompanies.map((c) => c.id) },
              ...sectionCompanies.map((company) => ({ _type: 'company' as const, key: company.id, company, index: filteredCompanies!.indexOf(company) })),
            ])
          : (paginatedCompanies ?? []).map((company, i) => ({ _type: 'company' as const, key: company.id, company, index: (companiesPage - 1) * companiesPageSize + i }))
        )?.map((item) =>
          item._type === 'header' ? (
            <div key={item.key} className="pt-3 pb-1 first:pt-0">
              <div
                className="flex items-center gap-2 cursor-pointer group rounded-md py-1.5 px-1 -mx-1 hover:bg-muted/50"
                onClick={(e) => toggleSourceGroupSelection(item.companyIds, e)}
              >
                <Checkbox
                  checked={item.companyIds.every((id) => selectedCompanyIds.has(id))}
                  onCheckedChange={() => {}}
                />
                <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2 flex-1">
                  {item.label}
                  <Badge variant="secondary" className="text-xs">{item.count}</Badge>
                </h3>
                <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                  {item.companyIds.every((id) => selectedCompanyIds.has(id)) ? 'Deselect all' : 'Select all'}
                </span>
              </div>
            </div>
          ) : (
            (() => {
              const { company, index } = item;
              const contactCount = company.contacts?.length || 0;
              const dealCount = company.deals?.length || 0;
              const hasEmail = !!(company.general_email || (company as any).generalEmail || company.contacts?.some((contact: any) => contact.email));
              const isEnriched = company.enrichment_status === 'completed';
              const companyTags = company.tags || [];
              const isSelected = selectedCompanyIds.has(company.id);
              const alreadyInContacts = isCompanyInContacts(company);
              const isNew = isCompanyNew(company);
              const shouldShowStatus = company.status && (company.status !== 'NEW' || isNew);

              return (
            <Card 
              key={company.id} 
              className={`transition-all hover:shadow-lg border bg-card/50 backdrop-blur-sm cursor-pointer ${isSelected ? 'ring-2 ring-primary border-primary' : ''}`}
              onClick={() => handleCompanyClick(company, index)}
            >
              <CardHeader className="pb-2 md:pb-3">
                <div className="flex items-start gap-3 md:gap-4">
                  {/* Checkbox for selection */}
                  <div 
                    className="flex items-center pt-1"
                    onClick={(e) => toggleCompanySelection(company.id, e)}
                  >
                    <Checkbox checked={isSelected} />
                  </div>
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center flex-shrink-0">
                    <Building2 className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="text-base md:text-lg font-semibold truncate">{company.name}</h3>
                      <div className="flex gap-1 flex-shrink-0">
                        <TemperatureBadge temperature={company.temperature} />
                        {isNew && (
                          <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-600 border-purple-500/20">
                            NEW
                          </Badge>
                        )}
                        {shouldShowStatus && company.status !== 'NEW' && (
                          <Badge variant="secondary" className="text-xs">
                            {company.status}
                          </Badge>
                        )}
                        {isEnriched && (
                          <Badge variant="outline" className="text-xs">
                            Enriched
                          </Badge>
                        )}
                        {hasEmail && (
                          <Badge variant="outline" className="text-xs">
                            Has Email
                          </Badge>
                        )}
                        {alreadyInContacts && (
                          <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/20">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            In Contacts
                          </Badge>
                        )}
                        {(() => {
                          const companyEmails = getCompanyEmails(company);
                          const sentCampaign = companyEmails.some(e => emailsSentInCampaign.has(e));
                          const sentNewsletter = companyEmails.some(e => emailsSentInNewsletter.has(e));
                          const campaignTagsForCompany = new Set<string>();
                          companyEmails.forEach(email => (emailToCampaignTags.get(email) || []).forEach(t => campaignTagsForCompany.add(t)));
                          const tagsList = Array.from(campaignTagsForCompany);
                          if (!sentCampaign && !sentNewsletter && tagsList.length === 0) return null;
                          return (
                            <>
                              {sentCampaign && (
                                <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                                  <Send className="h-3 w-3 mr-1" />
                                  Campaign
                                </Badge>
                              )}
                              {sentNewsletter && (
                                <Badge variant="outline" className="text-xs bg-violet-500/10 text-violet-600 border-violet-500/20">
                                  <Megaphone className="h-3 w-3 mr-1" />
                                  Newsletter
                                </Badge>
                              )}
                              {tagsList.slice(0, 3).map(tag => (
                                <Badge key={tag} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                              {tagsList.length > 3 && (
                                <Badge variant="secondary" className="text-xs">+{tagsList.length - 3}</Badge>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground flex-wrap">
                      {company.industry && <span>{company.industry}</span>}
                      {company.size && (
                        <>
                          <span>•</span>
                          <span>{company.size}</span>
                        </>
                      )}
                    </div>
                    {company.created_at && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Added {format(new Date(company.created_at), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    )}
                    {/* Tags display */}
                    {companyTags.length > 0 && (
                      <div className="mt-2">
                        <TagBadges 
                          tags={companyTags} 
                          maxDisplay={4}
                          onClick={handleTagFilterClick}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3 pt-0">
                {company.description && (
                  <p className="text-xs md:text-sm text-muted-foreground line-clamp-2">
                    {company.description}
                  </p>
                )}

                <div className="flex flex-wrap gap-1.5 md:gap-2 text-xs">
                  {company.headquarters && (
                    <div className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded">
                      <MapPin className="h-3 w-3" />
                      <span>{company.headquarters}</span>
                    </div>
                  )}
                  {company.employee_count && (
                    <div className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded">
                      <Users2 className="h-3 w-3" />
                      <span>{company.employee_count} employees</span>
                    </div>
                  )}
                  {contactCount > 0 && (
                    <div className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded">
                      <Mail className="h-3 w-3" />
                      <span>{contactCount} contact{contactCount > 1 ? 's' : ''}</span>
                    </div>
                  )}
                  {dealCount > 0 && (
                    <div className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded">
                      <Briefcase className="h-3 w-3" />
                      <span>{dealCount} deal{dealCount > 1 ? 's' : ''}</span>
                    </div>
                  )}
                  {company.company_phone && (
                    <div className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded">
                      <Phone className="h-3 w-3" />
                      <span>{company.company_phone}</span>
                    </div>
                  )}
                  {company.website && (
                    <div className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded">
                      <Globe className="h-3 w-3" />
                      <span className="truncate max-w-[200px]">{company.website}</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="flex-1 h-8 md:h-9 text-xs"
                    onClick={() => handleCompanyClick(company, index)}
                  >
                    <Eye className="h-3.5 w-3.5 mr-1.5" />
                    View Details
                  </Button>
                  {hasEmail && (
                    <Button
                      variant="default"
                      size="sm"
                      className="flex-1 h-8 md:h-9 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSendEmail(company);
                      }}
                    >
                      <Mail className="h-3.5 w-3.5 mr-1.5" />
                      Send Email
                    </Button>
                  )}
                  {hasEmail && (
                    <Button
                      variant={alreadyInContacts ? "secondary" : "outline"}
                      size="sm"
                      className="flex-1 h-8 md:h-9 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!alreadyInContacts) {
                          handleAddToContactList(company);
                        }
                      }}
                      disabled={alreadyInContacts}
                    >
                      {alreadyInContacts ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                          Already in Contacts
                        </>
                      ) : (
                        <>
                          <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                          Add to Contact List
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
              );
            })() )
        )}
      </div>

      {selectedCompany && companies && (
        <CompanyDetailsDialog
          company={selectedCompany}
          open={!!selectedCompany}
          onOpenChange={(open) => !open && setSelectedCompany(null)}
          allCompanies={filteredCompanies ?? companies}
          currentIndex={currentIndex}
          onNavigate={handleNavigate}
        />
      )}

      {emailRecipient && (
        <SendEmailDialog
          open={emailDialogOpen}
          onOpenChange={setEmailDialogOpen}
          recipientEmail={emailRecipient.email}
          recipientName={emailRecipient.name}
          companyId={emailRecipient.companyId}
          contactId={emailRecipient.contactId}
        />
      )}

      <AddContactDialog
        open={addContactDialogOpen}
        onOpenChange={(open) => {
          setAddContactDialogOpen(open);
          if (!open) {
            setCompanyForContact(null);
            setContactInitialValues(undefined);
          }
        }}
        initialValues={contactInitialValues}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["people"] });
          queryClient.invalidateQueries({ queryKey: ["people-emails"] });
          queryClient.invalidateQueries({ queryKey: ["companies-full"] });
          queryClient.invalidateQueries({ queryKey: ["companies-total-count"] });
          setAddContactDialogOpen(false);
          setCompanyForContact(null);
          setContactInitialValues(undefined);
        }}
      />

      <ApifyCSVUploader
        open={csvUploaderOpen}
        onOpenChange={setCsvUploaderOpen}
        onComplete={(companyIds) => {
          setCsvUploaderOpen(false);
          openBulkEmailForCompanyIds(companyIds);
        }}
      />

      <ApifyScraperDialog
        open={scraperDialogOpen}
        onOpenChange={setScraperDialogOpen}
        onComplete={(companyIds) => {
          setScraperDialogOpen(false);
          openBulkEmailForCompanyIds(companyIds);
        }}
      />

      <CampaignGroupingDialog
        open={groupingDialogOpen}
        onOpenChange={setGroupingDialogOpen}
        companies={groupingDialogCompanies}
        onContinueToCompose={handleBulkEmailFromCompanies}
      />

      {/* Create group from selection */}
      <Dialog open={createGroupDialogOpen} onOpenChange={setCreateGroupDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create recipient group</DialogTitle>
            <DialogDescription>
              Save the selected companies as a group. You can use it in Newsletters (Import from group) or Campaigns. Only companies with an email address are included.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="create-group-name">Group name</Label>
              <Input
                id="create-group-name"
                value={createGroupName}
                onChange={(e) => setCreateGroupName(e.target.value)}
                placeholder="e.g. Q1 prospects"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-group-desc">Description (optional)</Label>
              <Input
                id="create-group-desc"
                value={createGroupDescription}
                onChange={(e) => setCreateGroupDescription(e.target.value)}
                placeholder="e.g. Filtered by industry"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateGroupDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateGroupFromCompanies} disabled={creatingGroup || !createGroupName.trim()}>
              {creatingGroup ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Creating...</> : <><FolderPlus className="h-4 w-4 mr-1.5" />Create group</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedCompanyIds.size} companies?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected companies and all associated data including contacts, deals, and events. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={bulkDeleteMutation.isPending}
            >
              {bulkDeleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete {selectedCompanyIds.size} Companies
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
