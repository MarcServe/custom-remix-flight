import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Building2, Globe, ExternalLink, Users, MapPin, Sparkles, Package, Newspaper, DollarSign, Mail } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Contact {
  name: string;
  email?: string;
  emailVerified?: boolean;
  linkedinUrl?: string;
  title?: string;
  department?: string;
  phone?: string;
  companyName: string;
}

interface Company {
  name: string;
  website?: string;
  description?: string;
  industry?: string;
  size?: string;
  geography?: string;
  linkedinUrl?: string;
  wasEnriched?: boolean;
  products?: string;
  recentNews?: string;
  fundingInfo?: string;
  employeeCount?: number;
  contacts?: Contact[];
  primaryContact?: Contact;
}

interface CompanyDetailsDialogProps {
  company: Company | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CompanyDetailsDialog({ company, open, onOpenChange }: CompanyDetailsDialogProps) {
  if (!company) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 bg-gradient-to-br from-primary/5 via-primary/3 to-transparent">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-xl bg-gradient-primary flex items-center justify-center shadow-lg shrink-0">
              <Building2 className="h-8 w-8 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-2xl font-bold mb-2">{company.name}</DialogTitle>
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
              </div>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 pb-6 max-h-[calc(90vh-200px)]">
          <div className="space-y-6 pt-4">
            {/* Overview Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Overview
              </h3>
              {company.description && (
                <p className="text-sm text-foreground leading-relaxed">
                  {company.description}
                </p>
              )}
              <div className="grid grid-cols-2 gap-3">
                {company.geography && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Location:</span>
                    <span className="text-muted-foreground">{company.geography}</span>
                  </div>
                )}
                {company.employeeCount && (
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Employees:</span>
                    <span className="text-muted-foreground">{company.employeeCount}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Enriched Data Sections */}
            {company.wasEnriched && (
              <>
                <Separator />
                
                {company.products && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <Package className="h-4 w-4 text-blue-500" />
                      </div>
                      <h3 className="text-sm font-semibold">Products & Services</h3>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed pl-10">
                      {company.products}
                    </p>
                  </div>
                )}

                {company.recentNews && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                        <Newspaper className="h-4 w-4 text-purple-500" />
                      </div>
                      <h3 className="text-sm font-semibold">Recent News</h3>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed pl-10">
                      {company.recentNews}
                    </p>
                  </div>
                )}

                {company.fundingInfo && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                        <DollarSign className="h-4 w-4 text-green-500" />
                      </div>
                      <h3 className="text-sm font-semibold">Funding Information</h3>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed pl-10">
                      {company.fundingInfo}
                    </p>
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
                    <h3 className="text-sm font-semibold">Team Contacts</h3>
                  </div>
                  
                  <div className="space-y-3 pl-10">
                    {company.contacts.map((contact, idx) => (
                      <div key={idx} className="p-3 rounded-lg border bg-card/50 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{contact.name}</span>
                          {contact.emailVerified && (
                            <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/20">
                              Verified
                            </Badge>
                          )}
                          {contact === company.primaryContact && (
                            <Badge className="text-xs bg-primary/10 text-primary border-primary/20">
                              Primary
                            </Badge>
                          )}
                        </div>
                        
                        {contact.title && (
                          <p className="text-xs text-muted-foreground">{contact.title}</p>
                        )}
                        
                        {contact.email && (
                          <a 
                            href={`mailto:${contact.email}`}
                            className="text-xs text-primary hover:underline font-mono inline-flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Mail className="h-3 w-3" />
                            {contact.email}
                          </a>
                        )}
                        
                        {contact.linkedinUrl && (
                          <a 
                            href={contact.linkedinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="h-3 w-3" />
                            LinkedIn Profile
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Actions Section */}
            <Separator />
            <div className="flex gap-2">
              {company.linkedinUrl && (
                <Button variant="outline" size="sm" asChild>
                  <a href={company.linkedinUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5 mr-2" />
                    LinkedIn
                  </a>
                </Button>
              )}
              {company.website && (
                <Button variant="outline" size="sm" asChild>
                  <a 
                    href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    <Globe className="h-3.5 w-3.5 mr-2" />
                    Visit Website
                  </a>
                </Button>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
