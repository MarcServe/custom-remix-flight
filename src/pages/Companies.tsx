import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, MapPin, Users2, Mail, Eye, Briefcase, Globe, Phone } from "lucide-react";
import { CompanyDetailsDialog } from "@/components/CompanyDetailsDialog";
import { SendEmailDialog } from "@/components/SendEmailDialog";
import { ProspectAnalyzer, TemperatureBadge } from "@/components/ProspectAnalyzer";
import type { Company } from "@/lib/api/companies";

export default function Companies() {
  const queryClient = useQueryClient();
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState<{
    email: string;
    name: string;
    companyId?: string;
    contactId?: string;
  } | null>(null);

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
          // Map snake_case to camelCase
          linkedinUrl: company.linkedin_url,
          companyPhone: company.company_phone,
          generalEmail: company.general_email,
          employeeCount: company.employee_count,
          socialProfiles: company.social_profiles as any,
          keyExecutives: company.key_executives as any,
          techStack: company.tech_stack,
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

  if (isLoading) {
    return <div className="flex items-center justify-center h-96">Loading...</div>;
  }

  return (
    <div className="space-y-4 md:space-y-6 pt-12 lg:pt-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 md:px-0">
        <div>
          <h1 className="text-2xl md:text-4xl font-bold tracking-tight">Companies</h1>
          <p className="text-muted-foreground mt-1 md:mt-2 text-sm md:text-base">
            {companies?.length || 0} companies in your CRM
          </p>
        </div>
      </div>

      {companies && companies.length > 0 && (
        <div className="px-4 md:px-0">
          <ProspectAnalyzer 
            companies={companies} 
            onAnalysisComplete={() => queryClient.invalidateQueries({ queryKey: ["companies-full"] })}
          />
        </div>
      )}

      <div className="space-y-3 px-4 md:px-0 max-h-[calc(100vh-12rem)] overflow-y-auto">
        {companies?.map((company, index) => {
          const contactCount = company.contacts?.length || 0;
          const dealCount = company.deals?.length || 0;
          const hasEmail = company.general_email || company.contacts?.[0]?.email;
          const isEnriched = company.enrichment_status === 'completed';

          return (
            <Card 
              key={company.id} 
              className="transition-all hover:shadow-lg border bg-card/50 backdrop-blur-sm cursor-pointer"
              onClick={() => handleCompanyClick(company, index)}
            >
              <CardHeader className="pb-2 md:pb-3">
                <div className="flex items-start gap-3 md:gap-4">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center flex-shrink-0">
                    <Building2 className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="text-base md:text-lg font-semibold truncate">{company.name}</h3>
                      <div className="flex gap-1 flex-shrink-0">
                        <TemperatureBadge temperature={company.temperature} />
                        {company.status && (
                          <Badge variant="secondary" className="text-xs">
                            {company.status}
                          </Badge>
                        )}
                        {isEnriched && (
                          <Badge variant="outline" className="text-xs">
                            Enriched
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
                </div>
              </CardContent>
            </Card>
          );
        })}
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
    </div>
  );
}
