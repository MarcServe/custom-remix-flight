import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  CheckCircle2,
  Download,
  Filter,
  Globe,
  Info,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Search,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { COMPANY_SOURCE_TAGS } from "@/lib/company-sources";
import {
  HOSPITALITY_CAMPAIGN_TAG,
  HOSPITALITY_DECISION_MAKER_ROLES,
  HOSPITALITY_PROPERTY_TYPES,
  buildHospitalityAiSearchText,
  buildHospitalityMapsQuery,
} from "@/lib/data/hospitality-property-types";
import {
  downloadHospitalityLeadsCSV,
  type HospitalityLeadExportRow,
} from "@/lib/utils/hospitality-leads-export";
import { loadCuratedHospitalityLeads } from "@/lib/data/curated-hospitality-leads";
import { useLeadFinderStream } from "@/hooks/use-lead-finder-stream";
import { cn } from "@/lib/utils";

type Contact = {
  name: string;
  email?: string;
  emailVerified?: boolean;
  title?: string;
  phone?: string;
  linkedinUrl?: string;
  source?: string;
};

type HospitalityLead = {
  id: string;
  name: string;
  website?: string;
  phone?: string;
  email?: string;
  emailVerified?: boolean;
  emailSource?: "website" | "maps" | "getprospect" | "unknown";
  address?: string;
  city?: string;
  rating?: number;
  reviews?: number;
  category?: string;
  propertyType?: string;
  contacts?: Contact[];
  source: "google_maps" | "ai_search";
};

type PipelineStep = "idle" | "maps" | "emails" | "contacts" | "done";

function leadKey(name: string, website?: string, phone?: string): string {
  return [name, website || "", phone || ""].join("|").toLowerCase();
}

function isFreemail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase() || "";
  return [
    "gmail.com",
    "googlemail.com",
    "yahoo.com",
    "hotmail.com",
    "outlook.com",
    "icloud.com",
    "aol.com",
    "protonmail.com",
    "mail.com",
  ].some((d) => domain === d || domain.endsWith(`.${d}`));
}

function pickBestContact(contacts: Contact[] | undefined): Contact | undefined {
  if (!contacts?.length) return undefined;
  const roleHints = HOSPITALITY_DECISION_MAKER_ROLES.map((r) => r.toLowerCase());
  const scored = [...contacts].map((c) => {
    let score = 0;
    if (c.emailVerified && c.email) score += 50;
    if (c.email && !isFreemail(c.email)) score += 20;
    if (c.phone) score += 10;
    const title = (c.title || "").toLowerCase();
    if (roleHints.some((r) => title.includes(r.split(" ")[0]))) score += 15;
    return { c, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.c;
}

export default function HospitalityLeads() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const streamingSearch = useLeadFinderStream();

  const [selectedTypes, setSelectedTypes] = useState<string[]>(["hotels", "short-stay"]);
  const [location, setLocation] = useState("");
  const [maxResults, setMaxResults] = useState([50]);
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  const [mustHaveEmail, setMustHaveEmail] = useState(true);
  const [mustHavePhone, setMustHavePhone] = useState(false);
  const [enrichEmails, setEnrichEmails] = useState(true);
  const [findDecisionMakers, setFindDecisionMakers] = useState(true);

  const [pipelineStep, setPipelineStep] = useState<PipelineStep>("idle");
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [leads, setLeads] = useState<HospitalityLead[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"curated" | "maps" | "ai">("curated");
  const [curatedMeta, setCuratedMeta] = useState<{ generatedAt?: string; markets?: string[]; count?: number }>({});
  const [isLoadingCurated, setIsLoadingCurated] = useState(false);

  const isRunning = pipelineStep !== "idle" && pipelineStep !== "done";

  const loadCuratedIntoResults = async () => {
    setIsLoadingCurated(true);
    try {
      const file = await loadCuratedHospitalityLeads();
      const mapped: HospitalityLead[] = file.leads.map((raw) => {
        const contacts: Contact[] = [];
        if (raw.decisionMakerEmail || raw.decisionMakerName) {
          contacts.push({
            name: raw.decisionMakerName || "Decision maker",
            email: raw.decisionMakerEmail,
            emailVerified: true,
            title: raw.decisionMakerTitle,
            phone: raw.phone,
            source: "official_website",
          });
        }
        if (raw.salesEmail && raw.salesEmail !== raw.decisionMakerEmail) {
          contacts.push({
            name: "Sales",
            email: raw.salesEmail,
            emailVerified: true,
            title: "Sales",
            source: "official_website",
          });
        }
        if (
          raw.reservationsEmail &&
          raw.reservationsEmail !== raw.decisionMakerEmail &&
          raw.reservationsEmail !== raw.salesEmail
        ) {
          contacts.push({
            name: "Reservations",
            email: raw.reservationsEmail,
            emailVerified: true,
            title: "Reservations",
            source: "official_website",
          });
        }
        const best = pickBestContact(contacts);
        return {
          id: leadKey(raw.propertyName, raw.website, raw.phone),
          name: raw.propertyName,
          website: raw.website,
          phone: raw.phone,
          email: best?.email || raw.propertyEmail || raw.decisionMakerEmail,
          emailVerified: true,
          emailSource: "website",
          address: raw.address,
          city: [raw.city, raw.country].filter(Boolean).join(", "),
          category: raw.propertyType,
          propertyType: raw.propertyType,
          contacts,
          source: "google_maps" as const,
        };
      });
      setLeads(mapped);
      setSelectedIds(new Set(mapped.map((l) => l.id)));
      setCuratedMeta({
        generatedAt: file.generatedAt,
        markets: file.markets,
        count: mapped.length,
      });
      setPipelineStep("done");
      setProgress(100);
      setStatusMessage(
        `Loaded ${mapped.length} website-verified hospitality leads (${file.markets?.join(", ") || "multi-market"}).`
      );
      toast({
        title: "Curated leads loaded",
        description: `${mapped.length} properties with emails published on official contact pages.`,
      });
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Could not load curated leads",
        description: err?.message || "Missing verified-leads.json",
        variant: "destructive",
      });
    } finally {
      setIsLoadingCurated(false);
    }
  };

  useEffect(() => {
    if (activeTab === "curated" && leads.length === 0) {
      void loadCuratedIntoResults();
    }
    // intentionally only on first curated view
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const best = pickBestContact(lead.contacts);
      const email = best?.email || lead.email;
      const emailVerified = best?.emailVerified ?? lead.emailVerified ?? false;
      const phone = best?.phone || lead.phone;

      if (mustHaveEmail && !email) return false;
      if (mustHavePhone && !phone) return false;
      if (verifiedOnly && email && !emailVerified) {
        // Website-published business emails count as verified for outreach
        if (lead.emailSource !== "website") return false;
      }
      return true;
    });
  }, [leads, mustHaveEmail, mustHavePhone, verifiedOnly]);

  const stats = useMemo(() => {
    const withEmail = filteredLeads.filter((l) => l.email || pickBestContact(l.contacts)?.email).length;
    const withPhone = filteredLeads.filter((l) => l.phone || pickBestContact(l.contacts)?.phone).length;
    const verified = filteredLeads.filter((l) => {
      const best = pickBestContact(l.contacts);
      return best?.emailVerified || l.emailVerified || l.emailSource === "website";
    }).length;
    return { total: filteredLeads.length, withEmail, withPhone, verified };
  }, [filteredLeads]);

  const toggleType = (id: string) => {
    setSelectedTypes((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev;
        return prev.filter((t) => t !== id);
      }
      return [...prev, id];
    });
  };

  const mergeLeads = (incoming: HospitalityLead[]) => {
    setLeads((prev) => {
      const map = new Map(prev.map((l) => [l.id, l]));
      for (const lead of incoming) {
        const existing = map.get(lead.id);
        if (existing) {
          map.set(lead.id, {
            ...existing,
            ...lead,
            email: lead.email || existing.email,
            phone: lead.phone || existing.phone,
            website: lead.website || existing.website,
            contacts: lead.contacts?.length ? lead.contacts : existing.contacts,
            emailVerified: lead.emailVerified || existing.emailVerified,
            emailSource: lead.emailSource || existing.emailSource,
          });
        } else {
          map.set(lead.id, lead);
        }
      }
      return Array.from(map.values());
    });
  };

  const extractWebsiteEmails = async (batch: HospitalityLead[]): Promise<HospitalityLead[]> => {
    const withSites = batch.filter((l) => l.website);
    const updated: HospitalityLead[] = [];

    for (let i = 0; i < withSites.length; i++) {
      const lead = withSites[i];
      setProgress(35 + Math.round((i / Math.max(withSites.length, 1)) * 25));
      setStatusMessage(`Extracting website email (${i + 1}/${withSites.length}): ${lead.name}`);
      try {
        const { data, error } = await supabase.functions.invoke("extract-website-email", {
          body: { companyId: null, website: lead.website, companyName: lead.name },
        });
        if (error) continue;
        const businessEmail =
          data?.success && data?.email
            ? (data.email as string)
            : undefined;
        if (businessEmail && !isFreemail(businessEmail)) {
          updated.push({
            ...lead,
            email: businessEmail,
            emailVerified: true,
            emailSource: "website",
          });
        }
      } catch {
        // continue on per-lead failures
      }
    }
    return updated;
  };

  const discoverDecisionMakers = async (batch: HospitalityLead[]): Promise<HospitalityLead[]> => {
    const companies = batch
      .filter((l) => l.website || l.name)
      .map((l) => ({ name: l.name, website: l.website }));

    if (companies.length === 0) return [];

    setStatusMessage("Finding decision makers via GetProspect (verified emails only)...");
    const { data, error } = await supabase.functions.invoke("find-additional-contacts", {
      body: { companies },
    });

    if (error) {
      toast({
        title: "Contact discovery unavailable",
        description: error.message || "GetProspect may not be configured. Website emails will still be used.",
        variant: "destructive",
      });
      return [];
    }

    const results: Record<string, Contact[]> = data?.results || {};
    return batch.map((lead) => {
      const contacts = (results[lead.name] || []).filter((c) => {
        if (!c.email) return false;
        // Prefer provider-verified; drop freemail guesses
        if (isFreemail(c.email)) return false;
        return true;
      });
      const verifiedContacts = contacts.filter((c) => c.emailVerified);
      const useContacts = verifiedContacts.length > 0 ? verifiedContacts : contacts.filter((c) => c.emailVerified !== false);
      const best = pickBestContact(useContacts);
      return {
        ...lead,
        contacts: useContacts,
        email: lead.email || best?.email,
        emailVerified: lead.emailVerified || !!best?.emailVerified,
        emailSource: lead.emailSource || (best?.emailVerified ? "getprospect" : lead.emailSource),
        phone: lead.phone || best?.phone,
      };
    });
  };

  const runMapsPipeline = async () => {
    if (!location.trim()) {
      toast({ title: "Location required", description: "Enter a city, region, or country.", variant: "destructive" });
      return;
    }
    if (selectedTypes.length === 0) {
      toast({ title: "Select a property type", variant: "destructive" });
      return;
    }

    setPipelineStep("maps");
    setProgress(8);
    setStatusMessage("Searching public business listings on Google Maps...");
    setLeads([]);
    setSelectedIds(new Set());

    try {
      const query = buildHospitalityMapsQuery(selectedTypes);
      const { data, error } = await supabase.functions.invoke("apify-google-scraper", {
        body: {
          query,
          location: location.trim(),
          maxResults: maxResults[0],
          scrapeEmails: true,
        },
      });

      if (data?.error && typeof data.error === "string") throw new Error(data.error);
      if (error) throw error;

      const mapsLeads: HospitalityLead[] = (data?.leads || []).map((raw: any) => {
        const email = raw.email as string | undefined;
        return {
          id: leadKey(raw.name, raw.website, raw.phone),
          name: raw.name,
          website: raw.website,
          phone: raw.phone,
          email,
          emailVerified: !!email && !isFreemail(email),
          emailSource: email ? "maps" : undefined,
          address: raw.address,
          city: raw.city || location.trim(),
          rating: raw.rating,
          reviews: raw.reviews,
          category: raw.category,
          propertyType: selectedTypes
            .map((id) => HOSPITALITY_PROPERTY_TYPES.find((t) => t.id === id)?.label)
            .filter(Boolean)
            .join(", "),
          source: "google_maps" as const,
          contacts: [],
        };
      });

      setProgress(30);
      setStatusMessage(`Found ${mapsLeads.length} properties. Enriching contacts...`);
      mergeLeads(mapsLeads);
      setSelectedIds(new Set(mapsLeads.map((l) => l.id)));

      let working = mapsLeads;

      if (enrichEmails) {
        setPipelineStep("emails");
        const emailed = await extractWebsiteEmails(working);
        if (emailed.length) {
          mergeLeads(emailed);
          working = working.map((l) => emailed.find((e) => e.id === l.id) || l);
        }
      }

      if (findDecisionMakers) {
        setPipelineStep("contacts");
        setProgress(70);
        const withContacts = await discoverDecisionMakers(working);
        if (withContacts.length) {
          mergeLeads(withContacts);
        }
      }

      setPipelineStep("done");
      setProgress(100);
      setStatusMessage("Done. Review verified contacts below.");
      toast({
        title: "Hospitality search complete",
        description: `Found ${mapsLeads.length} properties. Filter for verified emails before exporting.`,
      });
    } catch (err: any) {
      console.error(err);
      setPipelineStep("idle");
      setProgress(0);
      const msg = err?.message || "Search failed";
      toast({
        title: "Search failed",
        description: msg.includes("APIFY")
          ? "Add APIFY_API_TOKEN in Supabase Edge Function secrets."
          : msg,
        variant: "destructive",
      });
    }
  };

  const runAiSearch = async () => {
    if (!location.trim()) {
      toast({ title: "Location required", description: "Enter a city, region, or country.", variant: "destructive" });
      return;
    }

    setPipelineStep("maps");
    setProgress(10);
    setStatusMessage("Running AI hospitality lead search...");

    const customSearchText = buildHospitalityAiSearchText(selectedTypes, location);
    await streamingSearch.findLeads({
      size: "1-10, 11-50, 51-200",
      geography: location.trim(),
      industry: "Hospitality, Hotels & Resorts",
      customSearchText,
      dryRun: true,
      provider: "openai",
      model: "gpt-4o-mini",
      enrichWithPerplexity: true,
      useSerpApi: true,
      maxResults: maxResults[0],
    });
  };

  // Sync AI stream results into hospitality leads when AI tab runs
  useEffect(() => {
    if (activeTab !== "ai") return;
    if (!streamingSearch.leads.length) return;

    const aiLeads: HospitalityLead[] = streamingSearch.leads.map((lead: any) => {
      const contacts: Contact[] = (lead.contacts || []).map((c: any) => ({
        name: c.name,
        email: c.email,
        emailVerified: !!c.emailVerified,
        title: c.title,
        phone: c.phone,
        linkedinUrl: c.linkedinUrl,
        source: c.source,
      }));
      const best = pickBestContact(contacts);
      return {
        id: leadKey(lead.name, lead.website, lead.companyPhone),
        name: lead.name,
        website: lead.website,
        phone: lead.companyPhone || best?.phone,
        email: lead.generalEmail || best?.email,
        emailVerified: !!best?.emailVerified || (!!lead.generalEmail && !isFreemail(lead.generalEmail || "")),
        emailSource: best?.emailVerified ? "getprospect" : lead.generalEmail ? "unknown" : undefined,
        address: lead.address,
        city: lead.geography || location,
        category: lead.industry,
        propertyType: "Hospitality",
        contacts,
        source: "ai_search" as const,
      };
    });

    setLeads(aiLeads);
    setSelectedIds(new Set(aiLeads.map((l) => l.id)));
    if (streamingSearch.isLoading) {
      setPipelineStep("contacts");
      setProgress(streamingSearch.progress || 40);
      setStatusMessage(streamingSearch.currentStatus || "Searching...");
    } else if (streamingSearch.leads.length > 0) {
      setPipelineStep("done");
      setProgress(100);
      setStatusMessage("AI search complete.");
    }
  }, [streamingSearch.leads, streamingSearch.isLoading, streamingSearch.progress, streamingSearch.currentStatus, activeTab, location]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => setSelectedIds(new Set(filteredLeads.map((l) => l.id)));
  const clearSelection = () => setSelectedIds(new Set());

  const selectedFiltered = filteredLeads.filter((l) => selectedIds.has(l.id));

  const handleExport = () => {
    if (selectedFiltered.length === 0) {
      toast({ title: "Nothing selected", description: "Select leads to export.", variant: "destructive" });
      return;
    }

    const rows: HospitalityLeadExportRow[] = selectedFiltered.map((lead) => {
      const best = pickBestContact(lead.contacts);
      return {
        propertyName: lead.name,
        propertyType: lead.propertyType || lead.category,
        website: lead.website,
        address: lead.address,
        city: lead.city,
        phone: lead.phone,
        email: lead.email,
        emailVerified: lead.emailVerified,
        emailSource: lead.emailSource,
        contactName: best?.name,
        contactTitle: best?.title,
        contactPhone: best?.phone,
        contactEmail: best?.email,
        contactEmailVerified: best?.emailVerified,
        rating: lead.rating,
        reviews: lead.reviews,
      };
    });

    downloadHospitalityLeadsCSV(rows);
    toast({ title: "Exported", description: `${rows.length} leads downloaded as CSV.` });
  };

  const handleSaveToCrm = async () => {
    if (!user) {
      toast({ title: "Sign in required", variant: "destructive" });
      return;
    }
    if (selectedFiltered.length === 0) {
      toast({ title: "Nothing selected", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    let imported = 0;
    let skipped = 0;

    try {
      for (const lead of selectedFiltered) {
        const best = pickBestContact(lead.contacts);
        const { data: existing } = await supabase
          .from("companies")
          .select("id")
          .eq("user_id", user.id)
          .ilike("name", lead.name)
          .maybeSingle();

        if (existing) {
          skipped++;
          continue;
        }

        const { data: created, error } = await supabase
          .from("companies")
          .insert({
            user_id: user.id,
            name: lead.name,
            website: lead.website || `no-website-${crypto.randomUUID()}`,
            company_phone: lead.phone || best?.phone || null,
            general_email: lead.email || best?.email || null,
            headquarters: lead.address || null,
            geography: lead.city || location || null,
            industry: lead.category || "Hospitality",
            tags: [COMPANY_SOURCE_TAGS.HOSPITALITY_LEADS, HOSPITALITY_CAMPAIGN_TAG],
            enrichment_data: {
              source: lead.source,
              email_source: lead.emailSource,
              email_verified: lead.emailVerified || best?.emailVerified || false,
              google_rating: lead.rating,
              google_reviews: lead.reviews,
              property_type: lead.propertyType,
            },
          })
          .select("id")
          .single();

        if (error || !created) continue;

        const contactsToInsert = (lead.contacts || [])
          .filter((c) => c.email || c.phone || c.name)
          .map((c, idx) => ({
            company_id: created.id,
            name: c.name || "Contact",
            email: c.email || null,
            email_verified: !!c.emailVerified,
            title: c.title || null,
            phone: c.phone || null,
            linkedin_url: c.linkedinUrl || null,
            is_primary_contact:
              idx === 0 ||
              (!!best &&
                ((best.email && c.email === best.email) ||
                  (best.name && c.name === best.name && c.title === best.title))),
          }));

        if (contactsToInsert.length === 0 && (lead.email || lead.phone)) {
          contactsToInsert.push({
            company_id: created.id,
            name: "Property contact",
            email: lead.email || null,
            email_verified: !!lead.emailVerified,
            title: "General enquiry",
            phone: lead.phone || null,
            linkedin_url: null,
            is_primary_contact: true,
          });
        }

        if (contactsToInsert.length > 0) {
          await supabase.from("contacts").insert(contactsToInsert);
        }

        imported++;
      }

      queryClient.invalidateQueries({ queryKey: ["companies"] });
      toast({
        title: "Saved to CRM",
        description: `Added ${imported} properties${skipped ? ` (${skipped} already existed)` : ""}.`,
      });
    } catch (err) {
      console.error(err);
      toast({ title: "Save failed", description: "Could not save leads to CRM.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            Hospitality Leads
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Find hotels, short-stay operators, B&amp;Bs, and serviced apartments with decision-maker emails and phones
            for TalkStay outreach — from public business listings and property websites.
          </p>
        </div>
        <Badge variant="outline" className="w-fit gap-1">
          <ShieldCheck className="h-3.5 w-3.5" />
          Verified-email focus
        </Badge>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Website-verified research batch included</AlertTitle>
        <AlertDescription className="text-sm space-y-1">
          <p>
            A starter list of <strong>UK website-verified</strong> hotels &amp; short-stay properties
            (London, Edinburgh, Brighton, Manchester, Bath, York) was researched from{" "}
            <strong>official contact pages</strong> — GM / MD / sales emails where published. Open the{" "}
            <strong>Curated verified</strong> tab to load, export, or add them to CRM.
          </p>
          <p className="text-muted-foreground">
            Scope for this batch is United Kingdom only. Airbnb host profiles and LinkedIn scraping are not used.
          </p>
        </AlertDescription>
      </Alert>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "curated" | "maps" | "ai")}>
        <TabsList>
          <TabsTrigger value="curated" className="gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            Curated verified
          </TabsTrigger>
          <TabsTrigger value="maps" className="gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            Maps &amp; websites
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            AI hospitality search
          </TabsTrigger>
        </TabsList>

        <TabsContent value="curated" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Hand-researched verified leads</CardTitle>
              <CardDescription>
                Emails taken from official hotel / serviced-apartment contact pages (not guessed). File:{" "}
                <code className="text-xs">data/hospitality-leads/verified-leads.csv</code>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {curatedMeta.count ? (
                <div className="flex flex-wrap gap-2 text-sm">
                  <Badge variant="secondary">{curatedMeta.count} properties</Badge>
                  {curatedMeta.markets?.map((m) => (
                    <Badge key={m} variant="outline">
                      {m}
                    </Badge>
                  ))}
                  {curatedMeta.generatedAt && (
                    <Badge variant="outline">Researched {curatedMeta.generatedAt}</Badge>
                  )}
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void loadCuratedIntoResults()} disabled={isLoadingCurated} className="gap-2">
                  {isLoadingCurated ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  {isLoadingCurated ? "Loading…" : "Load curated leads"}
                </Button>
                <Button variant="outline" asChild>
                  <a href="/data/hospitality-leads/verified-leads.csv" download>
                    <Download className="h-4 w-4 mr-2" />
                    Download CSV
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maps" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Search configuration</CardTitle>
              <CardDescription>
                Target property types in a location, then enrich emails and decision makers.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label>Property types</Label>
                <div className="flex flex-wrap gap-2">
                  {HOSPITALITY_PROPERTY_TYPES.map((type) => {
                    const active = selectedTypes.includes(type.id);
                    return (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => toggleType(type.id)}
                        className={cn(
                          "rounded-md border px-3 py-1.5 text-sm transition-colors",
                          active
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border bg-background text-muted-foreground hover:bg-muted/50"
                        )}
                      >
                        {type.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="hospitality-location">Location</Label>
                  <div className="relative">
                    <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="hospitality-location"
                      className="pl-8"
                      placeholder="e.g. Lagos, London, Dubai, Cape Town"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      disabled={isRunning}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Max properties: {maxResults[0]}</Label>
                  <Slider
                    value={maxResults}
                    onValueChange={setMaxResults}
                    min={10}
                    max={100}
                    step={10}
                    disabled={isRunning}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center justify-between rounded-md border p-3">
                  <span className="text-sm">Extract emails from property websites</span>
                  <Switch checked={enrichEmails} onCheckedChange={setEnrichEmails} disabled={isRunning} />
                </label>
                <label className="flex items-center justify-between rounded-md border p-3">
                  <span className="text-sm">Find decision makers (GetProspect verified)</span>
                  <Switch
                    checked={findDecisionMakers}
                    onCheckedChange={setFindDecisionMakers}
                    disabled={isRunning}
                  />
                </label>
              </div>

              <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
                Decision-maker roles prioritized: {HOSPITALITY_DECISION_MAKER_ROLES.slice(0, 6).join(", ")}, …
              </div>

              <Button onClick={runMapsPipeline} disabled={isRunning || streamingSearch.isLoading} className="gap-2">
                {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {isRunning ? "Searching…" : "Find hospitality leads"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">AI hospitality search</CardTitle>
              <CardDescription>
                Uses the existing Lead Finder pipeline with hospitality-focused prompts (Exa / SerpAPI / enrichment).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Property focus</Label>
                <div className="flex flex-wrap gap-2">
                  {HOSPITALITY_PROPERTY_TYPES.map((type) => {
                    const active = selectedTypes.includes(type.id);
                    return (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => toggleType(type.id)}
                        className={cn(
                          "rounded-md border px-3 py-1.5 text-sm transition-colors",
                          active
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border bg-background text-muted-foreground hover:bg-muted/50"
                        )}
                      >
                        {type.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ai-location">Geography</Label>
                <Input
                  id="ai-location"
                  placeholder="e.g. United Kingdom, Nigeria, UAE"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  disabled={streamingSearch.isLoading}
                />
              </div>
              <Button onClick={runAiSearch} disabled={streamingSearch.isLoading || isRunning} className="gap-2">
                {streamingSearch.isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {streamingSearch.isLoading ? "AI searching…" : "Run AI search"}
              </Button>
              {streamingSearch.isLoading && (
                <Button variant="outline" size="sm" onClick={() => streamingSearch.cancelSearch()}>
                  Cancel
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {(isRunning || streamingSearch.isLoading || pipelineStep === "done") && (
        <Card>
          <CardContent className="pt-6 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{statusMessage || streamingSearch.currentStatus}</span>
              <span className="tabular-nums">{progress || streamingSearch.progress}%</span>
            </div>
            <Progress value={progress || streamingSearch.progress} />
          </CardContent>
        </Card>
      )}

      {leads.length > 0 && (
        <>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="secondary">{stats.total} shown</Badge>
              <Badge variant="outline" className="gap-1">
                <Mail className="h-3 w-3" />
                {stats.withEmail} with email
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Phone className="h-3 w-3" />
                {stats.withPhone} with phone
              </Badge>
              <Badge variant="outline" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {stats.verified} verified / website
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={selectAllFiltered}>
                Select filtered
              </Button>
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                <X className="h-3.5 w-3.5 mr-1" />
                Clear
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5">
                <Download className="h-3.5 w-3.5" />
                Export CSV ({selectedFiltered.length})
              </Button>
              <Button size="sm" onClick={handleSaveToCrm} disabled={isSaving} className="gap-1.5">
                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                Add to CRM
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Campaign filters
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={verifiedOnly} onCheckedChange={(v) => setVerifiedOnly(!!v)} />
                Verified or website-published emails only
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={mustHaveEmail} onCheckedChange={(v) => setMustHaveEmail(!!v)} />
                Must have email
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={mustHavePhone} onCheckedChange={(v) => setMustHavePhone(!!v)} />
                Must have phone
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Results</CardTitle>
              <CardDescription>
                {selectedFiltered.length} of {filteredLeads.length} selected for export / CRM
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[min(60vh,560px)]">
                <ul className="divide-y">
                  {filteredLeads.map((lead) => {
                    const best = pickBestContact(lead.contacts);
                    const email = best?.email || lead.email;
                    const phone = best?.phone || lead.phone;
                    const verified = best?.emailVerified || lead.emailVerified || lead.emailSource === "website";
                    const checked = selectedIds.has(lead.id);

                    return (
                      <li
                        key={lead.id}
                        className={cn(
                          "flex gap-3 px-4 py-3 hover:bg-muted/30",
                          checked && "bg-primary/5"
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleSelect(lead.id)}
                          className="mt-1"
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-sm truncate">{lead.name}</p>
                            {lead.propertyType && (
                              <Badge variant="outline" className="text-[10px]">
                                {lead.propertyType}
                              </Badge>
                            )}
                            {verified && email && (
                              <Badge className="text-[10px] gap-0.5 bg-emerald-600 hover:bg-emerald-600">
                                <ShieldCheck className="h-3 w-3" />
                                Verified
                              </Badge>
                            )}
                          </div>
                          {(lead.address || lead.city) && (
                            <p className="text-xs text-muted-foreground truncate">
                              {[lead.address, lead.city].filter(Boolean).join(" · ")}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                            {email && (
                              <a href={`mailto:${email}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                                <Mail className="h-3 w-3" />
                                {email}
                              </a>
                            )}
                            {phone && (
                              <span className="inline-flex items-center gap-1 text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                {phone}
                              </span>
                            )}
                            {lead.website && (
                              <a
                                href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-muted-foreground hover:underline"
                              >
                                <Globe className="h-3 w-3" />
                                Website
                              </a>
                            )}
                          </div>
                          {best && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {best.name}
                              {best.title ? ` · ${best.title}` : ""}
                              {lead.contacts && lead.contacts.length > 1
                                ? ` (+${lead.contacts.length - 1} more)`
                                : ""}
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                  {filteredLeads.length === 0 && (
                    <li className="px-4 py-10 text-center text-sm text-muted-foreground">
                      No leads match the current filters. Try turning off &quot;verified only&quot; or re-run with email
                      extraction enabled.
                    </li>
                  )}
                </ul>
              </ScrollArea>
            </CardContent>
          </Card>
        </>
      )}

      {leads.length === 0 && pipelineStep === "idle" && !streamingSearch.isLoading && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center space-y-2">
            <Building2 className="h-10 w-10 mx-auto text-muted-foreground/60" />
            <p className="font-medium">No hospitality leads yet</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Choose property types, set a location, and run a search. Results with emails and phones appear here for
              your TalkStay email campaign.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
