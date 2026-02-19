import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Building2, MapPin, Users2, Mail, Eye, Briefcase, Globe, Phone, Upload, Filter, X, Trash2, Loader2, Sparkles, UserPlus, CheckCircle2, Wand2, Search } from "lucide-react";
import { CompanyDetailsDialog } from "@/components/CompanyDetailsDialog";
import { SendEmailDialog } from "@/components/SendEmailDialog";
import BulkEmailDialog from "@/components/BulkEmailDialog";
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
import { useToast } from "@/hooks/use-toast";
import type { Company } from "@/lib/api/companies";
import { getCompanySource, SOURCE_TAG_LIST } from "@/lib/company-sources";

export default function Companies() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [bulkEmailDialogOpen, setBulkEmailDialogOpen] = useState(false);
  const [bulkEmailPeople, setBulkEmailPeople] = useState<Array<{
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    company_id?: string;
    companies?: {
      id?: string;
      name?: string;
      tags?: string[];
      description?: string;
      industry?: string;
      website?: string;
      enrichment_data?: any;
      recent_news?: any;
      funding_stage?: string;
      funding_total?: number;
      employee_count?: number;
      tech_stack?: string[];
      key_executives?: any;
    };
  }>>([]);
  const [csvUploaderOpen, setCsvUploaderOpen] = useState(false);
  const [scraperDialogOpen, setScraperDialogOpen] = useState(false);
  const [selectedTagFilters, setSelectedTagFilters] = useState<string[]>([]);
  const [emailStatusFilter, setEmailStatusFilter] = useState<'all' | 'has-email' | 'has-email-not-in-contacts' | 'in-contacts' | 'no-email'>('all');
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [groupingDialogOpen, setGroupingDialogOpen] = useState(false);
  const [groupingDialogCompanies, setGroupingDialogCompanies] = useState<CompanyForGrouping[]>([]);
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [groupBySource, setGroupBySource] = useState(true);
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

  // Check if company is already in contacts
  const isCompanyInContacts = (company: Company) => {
    if (!peopleEmails) return false;
    const emailMatch = getCompanyEmailContact(company);
    if (!emailMatch?.email) return false;
    return peopleEmails.has(emailMatch.email.toLowerCase());
  };

  // Intelligently determine if a company should show as "NEW"
  const isCompanyNew = (company: Company) => {
    if (!company.created_at) return false;
    
    const createdDate = new Date(company.created_at);
    const updatedDate = company.updated_at ? new Date(company.updated_at) : null;
    const now = new Date();
    
    // Check if created within last 7 days
    const daysSinceCreation = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
    const isRecentlyCreated = daysSinceCreation <= 7;
    
    // Check if updated within last 7 days (and update was more recent than creation)
    const isRecentlyUpdated = updatedDate && 
      (now.getTime() - updatedDate.getTime()) / (1000 * 60 * 60 * 24) <= 7 &&
      updatedDate.getTime() > createdDate.getTime();
    
    return isRecentlyCreated || isRecentlyUpdated;
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
        const hasEmail = !!(company.general_email || company.generalEmail || company.contacts?.some(c => c.email));
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

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (companyIds: string[]) => {
      const { error } = await supabase
        .from('companies')
        .delete()
        .in('id', companyIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies-full'] });
      queryClient.invalidateQueries({ queryKey: ['company-existing-tags'] });
      setSelectedCompanyIds(new Set());
      setBulkDeleteDialogOpen(false);
      toast({ title: 'Success', description: `Deleted ${selectedCompanyIds.size} companies` });
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
    const companyEmail = company.general_email || company.generalEmail;
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

  const toggleSelectAll = () => {
    if (selectedCompanyIds.size === (filteredCompanies?.length || 0)) {
      setSelectedCompanyIds(new Set());
    } else {
      setSelectedCompanyIds(new Set((filteredCompanies || []).map(c => c.id)));
    }
  };

  const handleBulkDelete = () => {
    bulkDeleteMutation.mutate(Array.from(selectedCompanyIds));
  };

  const { data: companies, isLoading } = useQuery({
    queryKey: ["companies-full"],
    queryFn: async () => {
      const { data } = await supabase
        .from("companies")
        .select("*, contacts(*), deals(*), people(*)")
        .order("created_at", { ascending: false });
      
      // Map database columns to camelCase properties for the dialog
      return (data || []).map(company => {
        const enrichmentData = company.enrichment_data as any;
        return {
          ...company,
          // Explicitly preserve enrichment_data for tag extraction
          enrichment_data: company.enrichment_data,
          // Map snake_case to camelCase
          linkedinUrl: company.linkedin_url,
          companyPhone: company.company_phone,
          generalEmail: company.general_email,
          employeeCount: company.employee_count,
          socialProfiles: company.social_profiles as any,
          keyExecutives: company.key_executives as any,
          techStack: company.tech_stack,
          tags: company.tags || [],
          // Extract from enrichment_data JSONB if it exists
          products: enrichmentData?.products,
          recentNews: company.recent_news || enrichmentData?.recentNews,
          fundingInfo: enrichmentData?.fundingInfo || 
                       (company.funding_stage || company.funding_total 
                         ? `${company.funding_stage || ''}${company.funding_stage && company.funding_total ? ' - ' : ''}${company.funding_total || ''}` 
                         : undefined),
          wasEnriched: company.enrichment_status === 'completed',
        } as unknown as Company;
      });
    },
  });

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
    // Combine: prioritize actual company tags, then add presets and defaults
    const combined = new Set<string>();
    
    // First add all tags from actual companies (intelligent tags)
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

  // Filter companies by selected tags and email status
  const filteredCompanies = useMemo(() => {
    if (!companies) return [];
    
    // Debug: Check how many companies have tags
    const companiesWithTags = companies.filter(c => {
      const hasTags = (c.tags && Array.isArray(c.tags) && c.tags.length > 0);
      const enrichmentData = c.enrichment_data as any;
      const hasSuggestedTags = enrichmentData?.suggestedTags && Array.isArray(enrichmentData.suggestedTags) && enrichmentData.suggestedTags.length > 0;
      return hasTags || hasSuggestedTags;
    });
    
    console.log('[Filter] Starting filter with:', {
      totalCompanies: companies.length,
      companiesWithTags: companiesWithTags.length,
      selectedTagFilters,
      selectedTagFiltersCount: selectedTagFilters.length,
      sampleCompanyTags: companies.slice(0, 5).map(c => ({
        name: c.name,
        tags: c.tags,
        suggestedTags: (c.enrichment_data as any)?.suggestedTags
      }))
    });
    
    const filtered = companies.filter(company => {
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
        
        // Debug first few companies when filtering
        if (companies.indexOf(company) < 3) {
          console.log('[Filter] Company tag check:', {
            name: company.name,
            companyTags: companyTags,
            suggestedTags: suggestedTags,
            allCompanyTags: allCompanyTags,
            selectedTags: selectedTagFilters,
            selectedTagsLower: selectedTagsLower,
            hasEnrichmentData: !!enrichmentData
          });
        }
        
        // Use OR logic with partial matching: company matches if it has ANY of the selected tags
        // Also support partial matches (e.g., "translation" matches "translation service")
        // Normalize tags by trimming and lowercasing, but keep special characters for exact matching
        const normalizeTag = (tag: string) => tag
          .toLowerCase()
          .trim()
          .replace(/\s+/g, ' '); // Normalize multiple spaces to single space
        
        const normalizedCompanyTags = allCompanyTags.map(normalizeTag);
        const normalizedSelectedTags = selectedTagsLower.map(normalizeTag);
        
        const tagMatch = normalizedSelectedTags.length > 0 && normalizedSelectedTags.some(selectedTag => {
          // Exact match (normalized)
          if (normalizedCompanyTags.includes(selectedTag)) {
            if (companies.indexOf(company) < 3) {
              console.log(`[Filter] ✅ Exact match found for "${selectedTag}" in company "${company.name}"`);
            }
            return true;
          }
          
          // Partial match - check if any company tag contains the selected tag or vice versa
          const partialMatch = normalizedCompanyTags.some(companyTag => 
            companyTag.includes(selectedTag) || selectedTag.includes(companyTag)
          );
          
          if (partialMatch && companies.indexOf(company) < 3) {
            console.log(`[Filter] ✅ Partial match found for "${selectedTag}" in company "${company.name}"`);
          }
          
          return partialMatch;
        });
        
        if (!tagMatch) {
          return false;
        }
      }

    // Email status filter
    if (emailStatusFilter !== 'all') {
      const hasEmail = !!(company.general_email || company.generalEmail || company.contacts?.some(c => c.email));
      const inContacts = isCompanyInContacts(company);

      switch (emailStatusFilter) {
        case 'has-email':
          // Show companies that have email (regardless of whether in contacts)
          if (!hasEmail) return false;
          break;
        case 'has-email-not-in-contacts':
          // Show companies that have email but are NOT in contacts
          if (!hasEmail || inContacts) return false;
          break;
        case 'in-contacts':
          // Show companies that are already in contacts
          if (!inContacts) return false;
          break;
        case 'no-email':
          // Show companies without email (for easy extraction)
          if (hasEmail) return false;
          break;
      }
    }

      return true;
    });
    
    console.log('[Filter] Filter result:', {
      totalCompanies: companies.length,
      filteredCount: filtered.length,
      selectedTags: selectedTagFilters,
      companiesWithAnyTags: companiesWithTags.length
    });
    
    // If filtering by tags but no companies match, log detailed info
    if (selectedTagFilters.length > 0 && filtered.length === 0) {
      console.warn('[Filter] ⚠️ No companies matched the selected tags:', selectedTagFilters);
      
      // Find companies that might have similar tags - improved extraction
      const potentialMatches = companies.slice(0, 10).map(c => {
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
  }, [companies, selectedTagFilters, emailStatusFilter, peopleEmails, searchQuery, sourceFilter]);

  // Group filtered companies by source for display (when groupBySource is true)
  const companiesGroupedBySource = useMemo(() => {
    if (!groupBySource || !filteredCompanies.length) return null;
    const groups: Record<string, Company[]> = {};
    const order = [...SOURCE_TAG_LIST, "Other"];
    order.forEach((label) => { groups[label] = []; });
    for (const company of filteredCompanies) {
      const source = getCompanySource(company) || "Other";
      if (!groups[source]) groups[source] = [];
      groups[source].push(company);
    }
    return order.filter((label) => (groups[label]?.length ?? 0) > 0).map((label) => ({ label, companies: groups[label] }));
  }, [groupBySource, filteredCompanies]);

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
    if (!companies) return;
    
    const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex >= 0 && newIndex < companies.length) {
      setCurrentIndex(newIndex);
      setSelectedCompany(companies[newIndex]);
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

  const handleBulkEmailFromCompanies = async () => {
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

    try {
      // Get all people from selected companies, or create temporary entries for companies with general_email
      const peopleForEmail: Array<{
        id: string;
        first_name: string;
        last_name: string;
        email: string;
        company_id?: string;
        companies?: {
          id?: string;
          name?: string;
          tags?: string[];
        };
      }> = [];

      // Fetch people from database for these companies
      const companyIds = companiesWithEmail.map(c => c.id);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: existingPeople } = await supabase
        .from('people')
        .select('id, first_name, last_name, email, company_id, companies(id, name, tags)')
        .in('company_id', companyIds)
        .not('email', 'is', null);

      // Create a map of company_id -> existing people for that company
      const peopleByCompanyId = new Map<string, any[]>();
      if (existingPeople) {
        existingPeople.forEach((p: any) => {
          if (p.company_id) {
            if (!peopleByCompanyId.has(p.company_id)) {
              peopleByCompanyId.set(p.company_id, []);
            }
            peopleByCompanyId.get(p.company_id)!.push(p);
          }
        });
      }

      // Add all existing people to the list
      if (existingPeople) {
        peopleForEmail.push(...existingPeople.map((p: any) => ({
          id: p.id,
          first_name: p.first_name || '',
          last_name: p.last_name || '',
          email: p.email,
          company_id: p.company_id,
          companies: p.companies ? {
            id: p.companies.id,
            name: p.companies.name,
            tags: p.companies.tags || [],
          } : undefined,
        })));
      }

      // For companies without people in database, create people records using general_email or contact email
      // Also check if we need to add additional contacts from companies that already have some people
      const existingEmails = new Set(peopleForEmail.map(p => p.email.toLowerCase().trim()));
      
      for (const company of companiesWithEmail) {
        const companyPeople = peopleByCompanyId.get(company.id) || [];
        const emailMatch = getCompanyEmailContact(company);
        
        // If company has no people OR we want to add the primary contact email if not already added
        if (emailMatch?.email && !existingEmails.has(emailMatch.email.toLowerCase().trim())) {
          // Check if person with this email already exists (might be from a different company)
          const { data: existingPersonByEmail } = await supabase
            .from('people')
            .select('id, first_name, last_name, email, company_id, companies(id, name, tags)')
            .ilike('email', emailMatch.email)
            .maybeSingle();

          if (existingPersonByEmail) {
            // Use existing person, but update company_id if needed
            if (existingPersonByEmail.company_id !== company.id) {
              await supabase
                .from('people')
                .update({ company_id: company.id })
                .eq('id', existingPersonByEmail.id);
            }
            // Only add if not already in our list
            if (!peopleForEmail.find(p => p.id === existingPersonByEmail.id)) {
              peopleForEmail.push({
                id: existingPersonByEmail.id,
                first_name: existingPersonByEmail.first_name || '',
                last_name: existingPersonByEmail.last_name || '',
                email: existingPersonByEmail.email,
                company_id: company.id,
                companies: existingPersonByEmail.companies ? {
                  id: existingPersonByEmail.companies.id,
                  name: existingPersonByEmail.companies.name,
                  tags: existingPersonByEmail.companies.tags || [],
                } : undefined,
              });
              existingEmails.add(existingPersonByEmail.email.toLowerCase().trim());
            }
          } else {
            // Create new person record for this company
            const nameParts = emailMatch.type === 'contact' && emailMatch.contact?.name
              ? emailMatch.contact.name.trim().split(' ')
              : company.name.trim().split(' ');
            
            const firstName = nameParts[0] || company.name;
            const lastName = nameParts.slice(1).join(' ') || '';

            const { data: newPerson, error: createError } = await supabase
              .from('people')
              .insert({
                first_name: firstName,
                last_name: lastName,
                email: emailMatch.email,
                company_id: company.id,
                user_id: user.id,
              })
              .select('id, first_name, last_name, email, company_id')
              .single();

            if (!createError && newPerson) {
              peopleForEmail.push({
                id: newPerson.id,
                first_name: newPerson.first_name || '',
                last_name: newPerson.last_name || '',
                email: newPerson.email,
                company_id: newPerson.company_id,
                companies: {
                  id: company.id,
                  name: company.name,
                  tags: company.tags || [],
                },
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

      // Now fetch full company data with overview and tags for personalization
      const { data: companiesData } = await supabase
        .from('companies')
        .select('id, name, description, industry, website, enrichment_data, recent_news, funding_stage, funding_total, employee_count, tech_stack, key_executives, tags')
        .in('id', companyIds);

      // Enrich people with full company data
      const enrichedPeople = peopleForEmail.map(person => {
        const companyData = companiesData?.find(c => c.id === person.company_id);
        if (companyData) {
          // Normalize funding_total to number
          const fundingTotal = typeof companyData.funding_total === 'string' 
            ? (parseFloat(companyData.funding_total) || undefined)
            : (typeof companyData.funding_total === 'number' ? companyData.funding_total : undefined);
          
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
              // Include all company overview data for personalization
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
        // Return person as-is if no company data found
        return {
          id: person.id,
          first_name: person.first_name,
          last_name: person.last_name,
          email: person.email,
          company_id: person.company_id,
          companies: person.companies,
        };
      });

      // Store enriched people data and open bulk email dialog
      setBulkEmailPeople(enrichedPeople);
      setBulkEmailDialogOpen(true);
    } catch (error: any) {
      console.error('Error preparing bulk email:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to prepare bulk email",
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

  if (isLoading) {
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
          <p className="text-muted-foreground mt-1 md:mt-2 text-sm md:text-base">
            {filteredCompanies?.length || 0} of {companies?.length || 0} companies
            {(selectedTagFilters.length > 0 || emailStatusFilter !== 'all' || searchQuery.trim()) && " (filtered)"}
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
          <CampaignFitAnalyzer />
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
      {(selectedTagFilters.length > 0 || emailStatusFilter !== 'all' || sourceFilter) && (
        <div className="flex flex-wrap gap-2 px-4 md:px-0 items-center">
          <span className="text-sm text-muted-foreground">Filtering by:</span>
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
            onAnalysisComplete={() => queryClient.invalidateQueries({ queryKey: ["companies-full"] })}
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
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedCompanyIds(new Set())}
                  disabled={bulkExtractEmailMutation.isPending}
                >
                  Clear Selection
                </Button>
                {(() => {
                  const selectedCompanies = filteredCompanies?.filter(c => selectedCompanyIds.has(c.id)) || [];
                  const companiesWithoutEmail = selectedCompanies.filter(company => {
                    const hasEmail = !!(company.general_email || company.generalEmail || company.contacts?.some(c => c.email));
                    const website = company.website?.trim() || '';
                    const hasValidWebsite = website && 
                                            !website.startsWith('no-website-') && 
                                            website.length > 3 &&
                                            (website.startsWith('http://') || 
                                             website.startsWith('https://') || 
                                             website.includes('.') && !website.includes(' '));
                    return !hasEmail && hasValidWebsite;
                  });
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
                      {/* Always visible Bulk Email button - opens grouping preview then compose */}
                      <Button
                        variant={companiesWithEmail.length > 0 ? "default" : "outline"}
                        size="sm"
                        onClick={openGroupingOrBulkEmail}
                        disabled={bulkExtractEmailMutation.isPending}
                      >
                        <Mail className="h-4 w-4 mr-1" />
                        {companiesWithEmail.length > 0 ? `Send Bulk Email (${companiesWithEmail.length})` : "Send Bulk Email"}
                      </Button>
                    </>
                  );
                })()}
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setBulkDeleteDialogOpen(true)}
                  disabled={bulkExtractEmailMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete Selected
                </Button>
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

      {/* Select All Header */}
      {filteredCompanies && filteredCompanies.length > 0 && (
        <div className="flex items-center gap-3 px-4 md:px-0">
          <Checkbox
            checked={selectedCompanyIds.size === filteredCompanies.length && filteredCompanies.length > 0}
            onCheckedChange={toggleSelectAll}
          />
          <span className="text-sm text-muted-foreground">
            {selectedCompanyIds.size === filteredCompanies.length ? 'Deselect all' : 'Select all'}
          </span>
        </div>
      )}

      <div className="space-y-3 px-4 md:px-0 max-h-[calc(100vh-16rem)] overflow-y-auto">
        {(groupBySource && companiesGroupedBySource?.length
          ? companiesGroupedBySource.flatMap(({ label, companies: sectionCompanies }) => [
              { _type: 'header' as const, key: `header-${label}`, label, count: sectionCompanies.length },
              ...sectionCompanies.map((company) => ({ _type: 'company' as const, key: company.id, company, index: filteredCompanies!.indexOf(company) })),
            ])
          : (filteredCompanies ?? []).map((company, index) => ({ _type: 'company' as const, key: company.id, company, index }))
        )?.map((item) =>
          item._type === 'header' ? (
            <div key={item.key} className="pt-3 pb-1 first:pt-0">
              <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                {item.label}
                <Badge variant="secondary" className="text-xs">{item.count}</Badge>
              </h3>
            </div>
          ) : (
            (() => {
              const { company, index } = item;
              const contactCount = company.contacts?.length || 0;
              const dealCount = company.deals?.length || 0;
              const hasEmail = !!(company.general_email || company.generalEmail || company.contacts?.some(contact => contact.email));
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
          allCompanies={companies}
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
          setAddContactDialogOpen(false);
          setCompanyForContact(null);
          setContactInitialValues(undefined);
        }}
      />

      <ApifyCSVUploader
        open={csvUploaderOpen}
        onOpenChange={setCsvUploaderOpen}
      />

      <ApifyScraperDialog
        open={scraperDialogOpen}
        onOpenChange={setScraperDialogOpen}
      />

      <BulkEmailDialog
        open={bulkEmailDialogOpen}
        onOpenChange={(open) => {
          setBulkEmailDialogOpen(open);
          if (!open) {
            setBulkEmailPeople([]);
          }
        }}
        selectedPeople={bulkEmailPeople}
      />

      <CampaignGroupingDialog
        open={groupingDialogOpen}
        onOpenChange={setGroupingDialogOpen}
        companies={groupingDialogCompanies}
        onContinueToCompose={handleBulkEmailFromCompanies}
      />

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
