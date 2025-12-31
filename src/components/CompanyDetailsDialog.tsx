import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Building2, Globe, ExternalLink, Users, MapPin, Sparkles, Package, Newspaper, DollarSign, Mail, Search, Wand2, ChevronLeft, ChevronRight, Trash2, Calendar as CalendarIcon, Plus, Database, Loader2, Phone, TrendingUp, Award, CheckCircle2, XCircle, Circle, Copy, Linkedin, Shield } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { GenerateSequenceForCompanyDialog } from "@/components/sequences/GenerateSequenceForCompanyDialog";
import { SendEmailDialog } from "@/components/SendEmailDialog";
import { EventCard } from "@/components/EventCard";
import { EventDialog } from "@/components/EventDialog";
import { useDeleteCompany } from "@/hooks/use-companies";
import { useCompanyEvents, useDeleteEvent } from "@/hooks/use-events";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { companiesApi } from "@/lib/api/companies";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SuggestedActions } from "@/components/ProspectAnalyzer";

interface Contact {
  id?: string;
  name: string;
  email?: string;
  emailVerified?: boolean;
  emailConfidence?: number; // Lead finder format
  email_confidence?: number; // Database format
  linkedinUrl?: string;
  linkedin_url?: string; // Database format
  title?: string;
  department?: string;
  phone?: string;
  companyName: string;
}

interface Company {
  id: string;
  name: string;
  website?: string;
  description?: string;
  industry?: string;
  size?: string;
  geography?: string;
  linkedinUrl?: string;
  linkedin_url?: string; // Database format
  wasEnriched?: boolean;
  products?: string;
  recentNews?: string;
  recent_news?: string; // Database format
  fundingInfo?: string;
  funding_stage?: string; // Database format
  funding_total?: string; // Database format
  fundingStage?: string; // Lead finder format
  revenue?: string; // Lead finder format
  foundingYear?: number; // Lead finder format
  founding_year?: number; // Database format
  employeeCount?: number;
  employee_count?: number; // Database format
  companyPhone?: string;
  company_phone?: string; // Database format
  generalEmail?: string;
  general_email?: string; // Database format
  tech_stack?: string[]; // Database format
  technologies?: string[]; // Lead finder format
  enrichment_data?: {
    products?: string;
    fundingInfo?: string;
    recentNews?: string;
    technologies?: string[];
    revenue?: string;
    foundingYear?: number;
  };
  socialProfiles?: {
    linkedin?: string;
    twitter?: string;
    facebook?: string;
    instagram?: string;
    youtube?: string;
    tiktok?: string;
  };
  social_profiles?: { // Database format
    linkedin?: string;
    twitter?: string;
    facebook?: string;
    instagram?: string;
    youtube?: string;
    tiktok?: string;
  };
  keyExecutives?: Array<{
    name: string;
    title: string;
  }>;
  key_executives?: Array<{ // Database format
    name: string;
    title: string;
  }>;
  contacts?: Contact[];
  primaryContact?: Contact;
  enrichmentTier?: string; // Lead finder format
  qualityScore?: number; // Lead finder format
  dataCompleteness?: number; // Lead finder format
  enrichmentStatus?: string; // Lead finder format
  contactStatus?: string; // Lead finder format
  // Match intelligence (Lead finder format)
  matchReason?: string;
  matchSignals?: string[];
  source?: 'exa' | 'serpapi' | 'google_maps' | 'apify';
  // AI Analysis
  temperature?: 'hot' | 'warm' | 'cold';
  suggested_actions?: Array<{
    action: string;
    priority: 'high' | 'medium' | 'low';
    reason: string;
  }>;
  last_analyzed_at?: string;
}

interface CompanyDetailsDialogProps {
  company: Company | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSearching?: boolean;
  allCompanies?: any[];
  currentIndex?: number;
  onNavigate?: (direction: 'prev' | 'next') => void;
}

export function CompanyDetailsDialog({ 
  company, 
  open, 
  onOpenChange, 
  isSearching = false,
  allCompanies,
  currentIndex,
  onNavigate,
}: CompanyDetailsDialogProps) {
  const [isEnriching, setIsEnriching] = useState(false);
  const [generateSequenceDialogOpen, setGenerateSequenceDialogOpen] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState<{
    email: string;
    name: string;
    contactId?: string;
  } | null>(null);
  const { toast } = useToast();
  const deleteMutation = useDeleteCompany();
  const { data: eventsData } = useCompanyEvents(company?.id || '');
  const deleteEventMutation = useDeleteEvent();
  const queryClient = useQueryClient();

  // Keyboard navigation
  useEffect(() => {
    if (!open || !onNavigate) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && currentIndex !== undefined && currentIndex > 0) {
        onNavigate('prev');
      } else if (e.key === 'ArrowRight' && allCompanies && currentIndex !== undefined && currentIndex < allCompanies.length - 1) {
        onNavigate('next');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onNavigate, currentIndex, allCompanies]);
  
  if (!company) return null;

  // Normalize company data to handle both lead finder format (camelCase) and database format (snake_case)
  const normalizedCompany = {
    ...company,
    // Use camelCase versions if they exist, otherwise map from snake_case
    linkedinUrl: company.linkedinUrl || company.linkedin_url,
    recentNews: company.recentNews || company.recent_news || (company.enrichment_data as any)?.recentNews,
    fundingInfo: company.fundingInfo || 
                 company.fundingStage ||
                 (company.funding_stage && company.funding_total ? `${company.funding_stage} - ${company.funding_total}` : null) ||
                 (company.enrichment_data as any)?.fundingInfo,
    products: company.products || (company.enrichment_data as any)?.products,
    technologies: company.technologies || company.tech_stack || (company.enrichment_data as any)?.technologies,
    employeeCount: company.employeeCount || company.employee_count,
    companyPhone: company.companyPhone || company.company_phone,
    generalEmail: company.generalEmail || company.general_email,
    // Consolidate LinkedIn into socialProfiles and merge all social profiles
    socialProfiles: (() => {
      const profiles = {
        linkedin: company.linkedinUrl || company.linkedin_url || company.socialProfiles?.linkedin || company.social_profiles?.linkedin,
        twitter: company.socialProfiles?.twitter || company.social_profiles?.twitter,
        facebook: company.socialProfiles?.facebook || company.social_profiles?.facebook,
        instagram: company.socialProfiles?.instagram || company.social_profiles?.instagram,
        youtube: company.socialProfiles?.youtube || company.social_profiles?.youtube,
        tiktok: company.socialProfiles?.tiktok || company.social_profiles?.tiktok,
      };
      // Filter out undefined/null/empty values for cleaner object
      return Object.fromEntries(
        Object.entries(profiles).filter(([_, v]) => v && v.trim && v.trim() !== '')
      ) as typeof profiles;
    })(),
    keyExecutives: company.keyExecutives || company.key_executives,
    revenue: company.revenue || (company.enrichment_data as any)?.revenue,
    foundingYear: company.foundingYear || company.founding_year || (company.enrichment_data as any)?.foundingYear,
  };

  // Helper to check if social profiles have any truthy URLs
  const hasSocialProfiles = Object.values(normalizedCompany.socialProfiles).some(url => url && url.toString().trim() !== '');

  const hasContacts = normalizedCompany.contacts && normalizedCompany.contacts.length > 0;
  const hasBeenSaved = !!company.id;
  const showFindProspectsButton = !hasContacts && !isSearching && hasBeenSaved && normalizedCompany.linkedinUrl;
  
  const showNavigation = allCompanies && currentIndex !== undefined && onNavigate;
  const canGoPrev = showNavigation && currentIndex > 0;
  const canGoNext = showNavigation && allCompanies && currentIndex < allCompanies.length - 1;

  // Calculate data completeness with field breakdown
  const dataFields = {
    core: [
      { name: 'Name', value: company.name, required: true },
      { name: 'Website', value: company.website, required: false },
      { name: 'Description', value: company.description, required: false },
      { name: 'Industry', value: company.industry, required: true },
      { name: 'Size', value: company.size, required: true },
      { name: 'Geography', value: company.geography, required: true },
    ],
    enrichment: [
      { name: 'LinkedIn URL', value: normalizedCompany.linkedinUrl, required: false },
      { name: 'Employee Count', value: normalizedCompany.employeeCount, required: false },
      { name: 'Founding Year', value: normalizedCompany.foundingYear, required: false },
      { name: 'Revenue', value: normalizedCompany.revenue, required: false },
      { name: 'Company Phone', value: normalizedCompany.companyPhone, required: false },
      { name: 'General Email', value: normalizedCompany.generalEmail, required: false },
      { name: 'Products', value: normalizedCompany.products, required: false },
      { name: 'Recent News', value: normalizedCompany.recentNews, required: false },
      { name: 'Funding Info', value: normalizedCompany.fundingInfo, required: false },
      { name: 'Technologies', value: normalizedCompany.technologies?.length > 0, required: false },
      { name: 'Key Executives', value: normalizedCompany.keyExecutives?.length > 0, required: false },
      { name: 'Social Profiles', value: normalizedCompany.socialProfiles && Object.keys(normalizedCompany.socialProfiles).length > 0, required: false },
      { name: 'Contacts', value: hasContacts, required: false },
    ],
  };

  const allFields = [...dataFields.core, ...dataFields.enrichment];
  const filledFields = allFields.filter(f => f.value).length;
  const completeness = Math.round((filledFields / allFields.length) * 100);

  // Determine data sources
  const getDataSources = () => {
    const sources: string[] = [];
    if (isSearching) {
      sources.push('Exa Search');
      if (company.wasEnriched || company.enrichmentTier) {
        sources.push('Perplexity AI');
      }
      if (hasContacts) {
        sources.push('GetProspect');
      }
    }
    return sources;
  };

  const dataSources = getDataSources();

  const handleSendEmailToContact = (contact: Contact) => {
    if (!contact.email) {
      toast({
        title: "No Email",
        description: "This contact doesn't have an email address",
        variant: "destructive",
      });
      return;
    }
    
    setEmailRecipient({
      email: contact.email,
      name: contact.name,
      contactId: contact.id,
    });
    setEmailDialogOpen(true);
  };

  const handleCopyEmail = (email: string, contactName: string) => {
    navigator.clipboard.writeText(email);
    toast({
      title: "Email Copied",
      description: `${email} copied to clipboard`,
    });
  };

  const handleSaveToCRM = async () => {
    if (!company) return;

    setIsSaving(true);
    try {
      // Check if company already exists by website or name
      const { supabase: supabaseClient } = await import("@/integrations/supabase/client");
      
      // Refresh session to ensure user is properly authenticated (especially for new accounts)
      const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
      if (sessionError || !session) {
        throw new Error('Session expired. Please sign in again.');
      }
      
      let existingCompany = null;
      
      // If website exists, check by website
      if (company.website && company.website.trim()) {
        const { data } = await supabaseClient
          .from('companies')
          .select('id, name')
          .eq('website', company.website)
          .maybeSingle();
        existingCompany = data;
      }
      
      // If no website or no match found, check by name
      if (!existingCompany) {
        const { data } = await supabaseClient
          .from('companies')
          .select('id, name')
          .ilike('name', company.name)
          .maybeSingle();
        existingCompany = data;
      }

      if (existingCompany) {
        toast({
          title: 'Already Exists',
          description: `${existingCompany.name} is already in your CRM`,
          variant: 'destructive',
        });
        setIsSaving(false);
        return;
      }

      // Create company
      // Generate unique website placeholder if none exists
      const websiteValue = company.website && company.website.trim() 
        ? company.website 
        : `no-website-${crypto.randomUUID()}`;
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      const { data: createdCompany, error: companyError } = await companiesApi.createCompany({
        name: company.name,
        website: websiteValue,
        description: company.description,
        industry: company.industry,
        size: company.size,
        user_id: user.id,
        geography: company.geography,
        linkedin_url: company.linkedinUrl,
        company_phone: company.companyPhone,
        general_email: company.generalEmail,
        social_profiles: company.socialProfiles,
        key_executives: company.keyExecutives,
        employee_count: company.employeeCount,
        enriched_at: company.wasEnriched ? new Date().toISOString() : undefined,
        enrichment_data: company.wasEnriched ? {
          products: company.products,
          recentNews: company.recentNews,
          fundingInfo: company.fundingInfo,
        } : undefined,
      });

      if (companyError) {
        console.error('Error creating company:', companyError);
        throw companyError;
      }

      // Create contacts if they exist
      if (company.contacts && company.contacts.length > 0 && createdCompany) {
        const { supabase } = await import("@/integrations/supabase/client");
        const contactsToInsert = company.contacts.map((contact: any) => ({
          company_id: createdCompany.id,
          name: contact.name,
          email: contact.email,
          email_verified: contact.emailVerified,
          linkedin_url: contact.linkedinUrl,
          title: contact.title,
          department: contact.department,
          phone: contact.phone,
          is_primary_contact: contact === company.primaryContact,
        }));

        const { error: contactsError } = await supabase
          .from('contacts')
          .insert(contactsToInsert);

        if (contactsError) {
          console.error('Error creating contacts:', contactsError);
        }
      }

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline-stats'] });

      toast({
        title: 'Success',
        description: `${company.name} has been added to your CRM`,
      });

      // Close the dialog
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving company:', error);
      console.error('Error details:', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
      });
      
      // Handle duplicate company as informational, not an error
      if (error?.code === '23505') {
        toast({
          title: 'Already Saved',
          description: 'This company is already in your CRM.',
        });
        return;
      }
      
      let errorMessage = 'Failed to save company to CRM';
      
      // Handle other error cases
      if (error?.message === 'User not authenticated') {
        errorMessage = 'Please sign in again to continue';
      } else if (error?.code === '42501' || error?.message?.includes('permission denied') || error?.message?.includes('RLS')) {
        errorMessage = 'Permission denied. Please refresh the page and try again.';
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleFindProspects = async () => {
    if (!normalizedCompany.linkedinUrl) {
      toast({
        title: "LinkedIn URL required",
        description: "This company needs a LinkedIn URL to find prospects.",
        variant: "destructive",
      });
      return;
    }

    setIsEnriching(true);
    toast({
      title: "Finding prospects",
      description: `Searching for contacts at ${company.name}...`,
    });

    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error } = await supabase.functions.invoke('find-linkedin-prospects', {
        body: {
          companyId: company.id,
          linkedinUrl: company.linkedinUrl,
          companyName: company.name,
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Found ${data.inserted} prospects with contact details`,
      });

      // Close and reopen dialog to refresh data
      onOpenChange(false);
      setTimeout(() => onOpenChange(true), 100);
    } catch (error) {
      console.error("Find prospects error:", error);
      toast({
        title: "Error finding prospects",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsEnriching(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[90vh] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 bg-gradient-to-br from-primary/5 via-primary/3 to-transparent shrink-0">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-xl bg-gradient-primary flex items-center justify-center shadow-lg shrink-0">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-2">
                <DialogTitle className="text-2xl font-bold">{company.name}</DialogTitle>
                
                {showNavigation && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onNavigate!('prev')}
                      disabled={!canGoPrev}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground min-w-[60px] text-center">
                      {currentIndex! + 1} of {allCompanies!.length}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onNavigate!('next')}
                      disabled={!canGoNext}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              
              {company.website && (
                <a
                  href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline inline-flex items-center gap-1.5 font-medium"
                >
                  <Globe className="h-4 w-4" />
                  {company.website}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
              <div className="flex flex-wrap gap-2 mt-3">
                {company.wasEnriched && (
                  <Badge className="bg-gradient-primary">
                    <Sparkles className="h-3 w-3 mr-1" />
                    Enriched
                  </Badge>
                )}
                {company.industry && (
                  <Badge variant="secondary">{company.industry}</Badge>
                )}
                {company.size && (
                  <Badge variant="outline">{company.size}</Badge>
                )}
                {isSearching && (
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                    <Database className="h-3 w-3 mr-1" />
                    {completeness}% Complete
                  </Badge>
                )}
                {company.qualityScore !== undefined && (
                  <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                    <Award className="h-3 w-3 mr-1" />
                    Score: {company.qualityScore}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-6 mt-2 shrink-0">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="activity">Activity Timeline</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="data-[state=active]:flex data-[state=active]:flex-col data-[state=active]:flex-1 data-[state=active]:overflow-hidden mt-0">
            <ScrollArea className="flex-1 px-6 pb-6">
              <div className="space-y-6 pt-4">
            
            {/* Data Completeness Panel - Only show for Lead Finder results */}
            {isSearching && (
              <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">Data Completeness</h3>
                  </div>
                  <Badge variant="outline" className="bg-background">
                    {filledFields}/{allFields.length} fields
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Overall Progress</span>
                    <span className="font-medium">{completeness}%</span>
                  </div>
                  <Progress value={completeness} className="h-2" />
                </div>

                {/* Data Sources */}
                {dataSources.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    <span className="text-xs text-muted-foreground">Sources:</span>
                    {dataSources.map((source, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {source}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Field Status Grid */}
                <div className="pt-2 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Field Status:</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {allFields.map((field, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 text-xs">
                        {field.value ? (
                          <CheckCircle2 className="h-3 w-3 text-green-600" />
                        ) : field.required ? (
                          <XCircle className="h-3 w-3 text-red-600" />
                        ) : (
                          <Circle className="h-3 w-3 text-muted-foreground/40" />
                        )}
                        <span className={field.value ? "text-foreground" : "text-muted-foreground"}>
                          {field.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Overview Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Building2 className="h-4 w-4 text-blue-500" />
                </div>
                <h3 className="text-sm font-semibold">Company Overview</h3>
              </div>
              {company.description && (
                <p className="text-sm text-foreground leading-relaxed pl-10">
                  {company.description}
                </p>
              )}
              <div className="grid grid-cols-2 gap-3 pl-10">
                {company.geography && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Location:</span>
                    <span className="text-muted-foreground">{company.geography}</span>
                  </div>
                )}
                {company.size && (
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Company Size:</span>
                    <span className="text-muted-foreground">{company.size}</span>
                  </div>
                )}
                {normalizedCompany.employeeCount && (
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Employees:</span>
                    <span className="text-muted-foreground">{normalizedCompany.employeeCount.toLocaleString()}</span>
                  </div>
                )}
                {normalizedCompany.foundingYear && (
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Founded:</span>
                    <span className="text-muted-foreground">{normalizedCompany.foundingYear}</span>
                  </div>
                )}
                {normalizedCompany.revenue && (
                  <div className="flex items-center gap-2 text-sm">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Revenue:</span>
                    <span className="text-muted-foreground">{normalizedCompany.revenue}</span>
                  </div>
                )}
                {normalizedCompany.companyPhone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Phone:</span>
                    <a href={`tel:${normalizedCompany.companyPhone}`} className="text-primary hover:underline">
                      {normalizedCompany.companyPhone}
                    </a>
                  </div>
                )}
                {normalizedCompany.generalEmail && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Email:</span>
                    <a href={`mailto:${normalizedCompany.generalEmail}`} className="text-primary hover:underline">
                      {normalizedCompany.generalEmail}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Why This Company Was Chosen - Match Intelligence */}
            {(company.matchReason || (company.matchSignals && company.matchSignals.length > 0)) && (
              <>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
                      <Sparkles className="h-4 w-4 text-emerald-600" />
                    </div>
                    <h3 className="text-sm font-semibold">Why This Company?</h3>
                    <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                      <Search className="h-3 w-3 mr-1" />
                      Match Intelligence
                    </Badge>
                  </div>
                  {company.matchReason && (
                    <p className="text-sm text-muted-foreground leading-relaxed pl-10">
                      {company.matchReason}
                    </p>
                  )}
                  {company.matchSignals && company.matchSignals.length > 0 && (
                    <div className="pl-10 space-y-1.5">
                      {company.matchSignals.map((signal, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                          <span className="text-foreground">{signal}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* AI Suggested Actions */}
            {company.suggested_actions && company.suggested_actions.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                      <TrendingUp className="h-4 w-4 text-purple-600" />
                    </div>
                    <h3 className="text-sm font-semibold">AI-Suggested Next Actions</h3>
                    <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-600 border-purple-500/20">
                      <Sparkles className="h-3 w-3 mr-1" />
                      AI-Powered
                    </Badge>
                  </div>
                  <div className="pl-10">
                    <SuggestedActions actions={company.suggested_actions as any} />
                  </div>
                </div>
              </>
            )}

            {/* Enriched Data Sections - Show if ANY enriched data exists */}
            {(normalizedCompany.wasEnriched || normalizedCompany.products || normalizedCompany.recentNews || normalizedCompany.fundingInfo || 
              normalizedCompany.technologies?.length > 0 || normalizedCompany.keyExecutives?.length > 0 || 
              hasSocialProfiles) && (
              <>
                <Separator />
                
                {/* Products & Services */}
                {normalizedCompany.products && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <Package className="h-4 w-4 text-blue-500" />
                      </div>
                      <h3 className="text-sm font-semibold">Products & Services</h3>
                      {isSearching && (
                        <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-600 border-purple-500/20">
                          <Sparkles className="h-3 w-3 mr-1" />
                          Enriched
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed pl-10">
                      {normalizedCompany.products}
                    </p>
                  </div>
                )}

                {/* Technologies */}
                {normalizedCompany.technologies && normalizedCompany.technologies.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                        <Sparkles className="h-4 w-4 text-indigo-500" />
                      </div>
                      <h3 className="text-sm font-semibold">Technology Stack</h3>
                      {isSearching && (
                        <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-600 border-purple-500/20">
                          <Sparkles className="h-3 w-3 mr-1" />
                          Enriched
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 pl-10">
                      {normalizedCompany.technologies.map((tech, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {tech}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent News */}
                {normalizedCompany.recentNews && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                        <Newspaper className="h-4 w-4 text-purple-500" />
                      </div>
                      <h3 className="text-sm font-semibold">Recent News & Updates</h3>
                      {isSearching && (
                        <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-600 border-purple-500/20">
                          <Sparkles className="h-3 w-3 mr-1" />
                          Enriched
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed pl-10">
                      {normalizedCompany.recentNews}
                    </p>
                  </div>
                )}

                {/* Funding Information */}
                {normalizedCompany.fundingInfo && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                        <DollarSign className="h-4 w-4 text-green-500" />
                      </div>
                      <h3 className="text-sm font-semibold">Funding & Investment</h3>
                      {isSearching && (
                        <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-600 border-purple-500/20">
                          <Sparkles className="h-3 w-3 mr-1" />
                          Enriched
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed pl-10">
                      {normalizedCompany.fundingInfo}
                    </p>
                  </div>
                )}

                {/* Key Executives */}
                {normalizedCompany.keyExecutives && normalizedCompany.keyExecutives.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                        <Users className="h-4 w-4 text-amber-500" />
                      </div>
                      <h3 className="text-sm font-semibold">Leadership Team</h3>
                      {isSearching && (
                        <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-600 border-purple-500/20">
                          <Sparkles className="h-3 w-3 mr-1" />
                          Enriched
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-2 pl-10">
                      {normalizedCompany.keyExecutives.map((exec, idx) => (
                        <div key={idx} className="text-sm">
                          <span className="font-medium text-foreground">{exec.name}</span>
                          {" - "}
                          <span className="text-muted-foreground">{exec.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Social Profiles - Only show if there are actual URLs */}
                {hasSocialProfiles && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center">
                        <Globe className="h-4 w-4 text-pink-500" />
                      </div>
                      <h3 className="text-sm font-semibold">Social Media Presence</h3>
                    </div>
                    <div className="flex flex-wrap gap-2 pl-10">
                      {normalizedCompany.socialProfiles.linkedin && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={normalizedCompany.socialProfiles.linkedin} target="_blank" rel="noopener noreferrer">
                            LinkedIn
                          </a>
                        </Button>
                      )}
                      {normalizedCompany.socialProfiles.twitter && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={normalizedCompany.socialProfiles.twitter} target="_blank" rel="noopener noreferrer">
                            Twitter
                          </a>
                        </Button>
                      )}
                      {normalizedCompany.socialProfiles.facebook && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={normalizedCompany.socialProfiles.facebook} target="_blank" rel="noopener noreferrer">
                            Facebook
                          </a>
                        </Button>
                      )}
                      {normalizedCompany.socialProfiles.instagram && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={normalizedCompany.socialProfiles.instagram} target="_blank" rel="noopener noreferrer">
                            Instagram
                          </a>
                        </Button>
                      )}
                      {normalizedCompany.socialProfiles.youtube && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={normalizedCompany.socialProfiles.youtube} target="_blank" rel="noopener noreferrer">
                            YouTube
                          </a>
                        </Button>
                      )}
                      {normalizedCompany.socialProfiles.tiktok && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={normalizedCompany.socialProfiles.tiktok} target="_blank" rel="noopener noreferrer">
                            TikTok
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Team Contacts Section */}
            {company.contacts && company.contacts.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                      <Users className="h-4 w-4 text-cyan-500" />
                    </div>
                    <h3 className="text-sm font-semibold">Team Contacts ({company.contacts.length})</h3>
                    {isSearching && (
                      <Badge variant="outline" className="text-xs bg-cyan-500/10 text-cyan-600 border-cyan-500/20">
                        <Database className="h-3 w-3 mr-1" />
                        GetProspect
                      </Badge>
                    )}
                  </div>
                  
                  <div className="space-y-3 pl-10">
                    {company.contacts.map((contact, idx) => {
                      const emailConfidence = contact.emailConfidence || contact.email_confidence;
                      const contactLinkedIn = contact.linkedinUrl || contact.linkedin_url;
                      
                      return (
                        <div key={idx} className="p-4 rounded-lg border bg-card/50 hover:bg-card/70 transition-colors space-y-3">
                          {/* Header with name and badges */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm">{contact.name}</span>
                                
                                {/* Verification Badge */}
                                {contact.emailVerified && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/20">
                                          <Shield className="h-3 w-3 mr-1" />
                                          Verified
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Email address has been verified</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                                
                                {/* Email Confidence Score */}
                                {emailConfidence && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <Badge 
                                          variant="outline" 
                                          className={`text-xs ${
                                            emailConfidence >= 90 
                                              ? 'bg-green-500/10 text-green-600 border-green-500/20' 
                                              : emailConfidence >= 70 
                                              ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20'
                                              : 'bg-orange-500/10 text-orange-600 border-orange-500/20'
                                          }`}
                                        >
                                          <TrendingUp className="h-3 w-3 mr-1" />
                                          {emailConfidence}% confidence
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Email accuracy confidence score</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                                
                                {/* Primary Contact Badge */}
                                {contact === company.primaryContact && (
                                  <Badge className="text-xs bg-primary/10 text-primary border-primary/20">
                                    Primary
                                  </Badge>
                                )}
                              </div>
                              
                              {/* Title and Department */}
                              {contact.title && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {contact.title}
                                  {contact.department && ` • ${contact.department}`}
                                </p>
                              )}
                            </div>
                            
                            {/* Action Button */}
                            {contact.email && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSendEmailToContact(contact);
                                }}
                              >
                                <Mail className="h-4 w-4 mr-1" />
                                Send
                              </Button>
                            )}
                          </div>
                          
                          {/* Contact Details */}
                          <div className="space-y-2">
                            {/* Email with Copy Button */}
                            {contact.email && (
                              <div className="flex items-center gap-2 group">
                                <Mail className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                <a 
                                  href={`mailto:${contact.email}`}
                                  className="text-xs text-primary hover:underline font-mono flex-1 min-w-0 truncate"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {contact.email}
                                </a>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCopyEmail(contact.email!, contact.name);
                                  }}
                                  title="Copy email"
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                            
                            {/* Phone */}
                            {contact.phone && (
                              <div className="flex items-center gap-2">
                                <Phone className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                <a 
                                  href={`tel:${contact.phone}`}
                                  className="text-xs text-primary hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {contact.phone}
                                </a>
                              </div>
                            )}
                            
                            {/* LinkedIn Profile */}
                            {contactLinkedIn && (
                              <div className="flex items-center gap-2">
                                <Linkedin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                <a 
                                  href={contactLinkedIn}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  View LinkedIn Profile
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* Actions Section */}
            <Separator />
            <div className="flex flex-wrap gap-2">
              {!hasBeenSaved && (
                <Button 
                  variant="default" 
                  size="sm" 
                  onClick={handleSaveToCRM}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Database className="h-3.5 w-3.5 mr-2" />
                      Save to CRM
                    </>
                  )}
                </Button>
              )}
              {showFindProspectsButton && (
                <Button 
                  variant="default" 
                  size="sm" 
                  onClick={handleFindProspects}
                  disabled={isEnriching}
                >
                  <Search className="h-3.5 w-3.5 mr-2" />
                  {isEnriching ? "Finding..." : "Find Prospects"}
                </Button>
              )}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setGenerateSequenceDialogOpen(true)}
                disabled={!company.id}
                title={!company.id ? "Save company to CRM first to generate sequences" : undefined}
              >
                <Wand2 className="h-3.5 w-3.5 mr-2" />
                Generate Sequence
              </Button>
              {normalizedCompany.linkedinUrl && (
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={normalizedCompany.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View LinkedIn
                  </a>
                </Button>
              )}
               {company.id && (
                 <Button 
                   variant="outline" 
                   size="sm" 
                   onClick={() => setDeleteDialogOpen(true)}
                   className="ml-auto text-destructive hover:text-destructive"
                 >
                   <Trash2 className="h-3.5 w-3.5 mr-2" />
                   Delete
                 </Button>
               )}
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="activity" className="data-[state=active]:flex data-[state=active]:flex-col data-[state=active]:flex-1 data-[state=active]:overflow-hidden mt-0">
            <ScrollArea className="flex-1 px-6 pb-6">
              <div className="space-y-4 pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Recent Activity
                  </h3>
                  <Button size="sm" onClick={() => setEventDialogOpen(true)}>
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    Add Event
                  </Button>
                </div>

                {eventsData?.data && eventsData.data.length > 0 ? (
                  <div className="space-y-3">
                    {(eventsData.data as Array<{
                      id: string;
                      type: 'note' | 'call' | 'email' | 'meeting' | 'task' | 'reminder';
                      content: { title?: string; description?: string };
                      created_at: string;
                      due_at?: string;
                    }>).map((event) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        onDelete={async (id) => {
                          if (confirm('Delete this event?')) {
                            await deleteEventMutation.mutateAsync(id);
                          }
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <CalendarIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No activity yet</p>
                     <p className="text-xs mt-1">Start tracking interactions with this company</p>
                 </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>

      <EventDialog 
        open={eventDialogOpen} 
        onOpenChange={setEventDialogOpen}
        defaultCompanyId={company.id}
      />

      <GenerateSequenceForCompanyDialog
        open={generateSequenceDialogOpen}
        onOpenChange={setGenerateSequenceDialogOpen}
        companyId={company.id}
        companyName={company.name}
        companyDescription={company.description}
        companySize={company.size}
        companyGeography={company.geography}
        companyIndustry={company.industry}
      />

      {emailRecipient && (
        <SendEmailDialog
          open={emailDialogOpen}
          onOpenChange={setEmailDialogOpen}
          recipientEmail={emailRecipient.email}
          recipientName={emailRecipient.name}
          companyId={company.id}
          contactId={emailRecipient.contactId}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Company</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{company.name}</strong>? This will also delete all associated contacts, deals, and events. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                try {
                  await deleteMutation.mutateAsync(company.id);
                  onOpenChange(false);
                } catch (error) {
                  console.error('Delete error:', error);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
