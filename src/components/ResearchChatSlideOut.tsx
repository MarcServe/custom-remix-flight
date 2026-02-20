"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useResearchChat } from "@/contexts/ResearchChatContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  MessageSquare,
  Search,
  Loader2,
  Send,
  Building2,
  Download,
  Sparkles,
  FileSpreadsheet,
  Table2,
  History,
  Trash2,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { COMPANY_SOURCE_TAGS } from "@/lib/company-sources";
import { useCompanyTags } from "@/hooks/use-company-tags";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface SearchLead {
  name: string;
  website?: string;
  description?: string;
  industry?: string;
  geography?: string;
  generalEmail?: string;
  general_email?: string;
  contacts?: Array<{ name?: string; email?: string; title?: string }>;
  primaryContact?: { name?: string; email?: string };
}

/** CRM-consumable row extracted from chat (same shape for import) */
type ExtractedRow = {
  name: string;
  website?: string;
  email?: string;
  industry?: string;
  geography?: string;
  notes?: string;
};

const RESEARCH_SYSTEM_PROMPT = `You are a research assistant for lead generation and CRM. Follow these rules strictly:

1. LISTS: Always use numbered lists for any list of companies, contacts, or items. Format: "1. Name – detail" or "1. Company Name (Industry, Location)". One item per line. No raw paragraphs of comma-separated names.

2. STRUCTURE: Use clear section headings on their own line, e.g. "Top retail companies" or "Summary". Then list items below with numbers 1. 2. 3.

3. DETAILS: For companies, include name and when possible: industry, location, or one-line note. If you cannot provide real contact emails, say so briefly once, then still list company names in a numbered list so the user can export them.

4. LENGTH: For "list of N" requests, provide up to that many items (e.g. 100 if asked), each on its own numbered line. Keep intro and outro to 1–2 short sentences.`;

/** Renders assistant message with modern card-style layout and numbered list design */
function formatChatContent(content: string) {
  const lines = content.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const out: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const numberedMatch = line.match(/^(\d+)[.)]\s+(.+)$/);
    const bulletMatch = /^[-*•]\s+/.test(line);
    const looksLikeHeading = line.length < 60 && (line.length < 40 || !line.includes(".")) && (i === 0 || lines[i - 1]?.trim() === "");

    if (numberedMatch) {
      const list: { num: number; text: string }[] = [{ num: parseInt(numberedMatch[1], 10), text: numberedMatch[2] }];
      i++;
      while (i < lines.length) {
        const next = lines[i];
        const nextNum = next.match(/^(\d+)[.)]\s+(.+)$/);
        if (nextNum) {
          list.push({ num: parseInt(nextNum[1], 10), text: nextNum[2] });
          i++;
        } else break;
      }
      out.push(
        <div key={out.length} className="my-3 space-y-2">
          {list.map((item, j) => (
            <div
              key={j}
              className="flex items-start gap-3 rounded-lg border bg-card px-3 py-2.5 text-sm shadow-sm transition-colors hover:bg-muted/50"
            >
              <span className="flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                {item.num}
              </span>
              <span className="flex-1 pt-0.5 leading-snug">{item.text}</span>
            </div>
          ))}
        </div>
      );
      continue;
    }

    if (bulletMatch) {
      const list: string[] = [line.replace(/^[-*•]\s+/, "")];
      i++;
      while (i < lines.length && /^[-*•]\s+/.test(lines[i])) {
        list.push(lines[i].replace(/^[-*•]\s+/, ""));
        i++;
      }
      out.push(
        <ul key={out.length} className="my-2 space-y-1.5 pl-1">
          {list.map((t, j) => (
            <li key={j} className="flex items-start gap-2 text-sm">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
              <span className="leading-snug">{t}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    if (looksLikeHeading && out.length > 0) {
      out.push(
        <h4 key={out.length} className="mt-4 mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {line}
        </h4>
      );
    } else {
      out.push(
        <p key={out.length} className="text-sm leading-relaxed text-foreground/90">
          {line}
        </p>
      );
    }
    i++;
  }

  return out.length ? <div className="space-y-1">{out}</div> : <p className="text-sm whitespace-pre-wrap">{content}</p>;
}

const RESEARCH_CHAT_HISTORY_DAYS = 30;

export function ResearchChatSlideOut() {
  const { open, setOpen } = useResearchChat();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyLoadError, setHistoryLoadError] = useState(false);
  const [historyUpdatedAt, setHistoryUpdatedAt] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"chat" | "history">("chat");
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchLead[]>([]);
  const [importing, setImporting] = useState(false);
  const [extractedFromChat, setExtractedFromChat] = useState<ExtractedRow[] | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [importCategoryTag, setImportCategoryTag] = useState("");
  const [sendIncompleteToEnrichment, setSendIncompleteToEnrichment] = useState(false);
  const { allSuggestions: categoryTagSuggestions } = useCompanyTags();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load chat history when panel opens (retain 30 days)
  useEffect(() => {
    if (!open || !user?.id) {
      if (!open) setHistoryLoaded(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await (supabase as any)
        .from("research_chat_history")
        .select("messages, updated_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setHistoryLoadError(true);
        setMessages([]);
        setHistoryUpdatedAt(null);
        setHistoryLoaded(true);
        return;
      }
      setHistoryLoadError(false);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - RESEARCH_CHAT_HISTORY_DAYS);
      const updatedAt = data?.updated_at ? new Date(data.updated_at) : null;
      if (data?.messages && Array.isArray(data.messages) && updatedAt && updatedAt >= cutoff) {
        setMessages(data.messages as ChatMessage[]);
        setHistoryUpdatedAt(data.updated_at);
      } else {
        setMessages([]);
        setHistoryUpdatedAt(updatedAt ? data?.updated_at ?? null : null);
      }
      setHistoryLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [open, user?.id]);

  const saveHistory = useCallback(
    async (msgs: ChatMessage[]) => {
      if (!user?.id) return;
      const now = new Date().toISOString();
      const { error } = await (supabase as any)
        .from("research_chat_history")
        .upsert(
          { user_id: user.id, messages: msgs, updated_at: now },
          { onConflict: "user_id" }
        );
      if (!error) setHistoryUpdatedAt(now);
    },
    [user?.id]
  );

  const clearHistory = useCallback(async () => {
    if (!user?.id) return;
    setMessages([]);
    setHistoryUpdatedAt(null);
    setExtractedFromChat(null);
    await (supabase as any)
      .from("research_chat_history")
      .upsert(
        { user_id: user.id, messages: [], updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
    toast({ title: "History cleared", description: "Conversation history has been reset." });
  }, [user?.id, toast]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendChat = async () => {
    const text = input.trim();
    if (!text || chatLoading) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setChatLoading(true);

    try {
      const chatMessages = [
        { role: "system" as const, content: RESEARCH_SYSTEM_PROMPT },
        ...messages,
        userMsg,
      ].map((m) => ({ role: m.role, content: m.content }));

      const { data, error } = await supabase.functions.invoke("ai-provider", {
        body: {
          messages: chatMessages,
          stream: false,
          provider: "openai",
          model: "gpt-4o-mini",
        },
      });

      if (error) throw error;
      const content = data?.content ?? "No response.";
      const newMessages: ChatMessage[] = [...messages, userMsg, { role: "assistant", content }];
      setMessages(newMessages);
      saveHistory(newMessages);
    } catch (err: any) {
      toast({
        title: "Chat error",
        description: err?.message ?? "Failed to get reply",
        variant: "destructive",
      });
      const fallback: ChatMessage[] = [
        ...messages,
        userMsg,
        { role: "assistant", content: "Sorry, I couldn’t process that. Please try again." },
      ];
      setMessages(fallback);
      saveHistory(fallback);
    } finally {
      setChatLoading(false);
    }
  };

  const runSearch = async () => {
    const query = searchQuery.trim() || messages[messages.length - 1]?.content?.trim() || "";
    if (!query || searchLoading) return;

    setSearchLoading(true);
    setSearchResults([]);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Please sign in", variant: "destructive" });
        return;
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/lead-finder`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customSearchText: query,
          size: "",
          geography: "",
          industry: "",
          dryRun: true,
          useSerpApi: false,
          useApify: false,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Search failed: ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const collected: SearchLead[] = [];
      const maxLeads = 15;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const dataStr = line.slice(6).trim();
          if (dataStr === "[DONE]") break;

          try {
            const event = JSON.parse(dataStr);
            if (event.type === "batch" && event.leads?.length) {
              for (const lead of event.leads) {
                if (collected.length >= maxLeads) break;
                collected.push(lead);
              }
              setSearchResults([...collected]);
            } else if (event.type === "lead" && event.lead) {
              if (collected.length < maxLeads) {
                collected.push(event.lead);
                setSearchResults([...collected]);
              }
            }
          } catch (_) {}
        }
      }

      setSearchResults([...collected]);
      if (collected.length === 0) {
        toast({ title: "No leads found", description: "Try a different search." });
      } else {
        toast({ title: "Search complete", description: `Found ${collected.length} leads` });
      }
    } catch (err: any) {
      toast({
        title: "Search failed",
        description: err?.message ?? "Could not run lead search",
        variant: "destructive",
      });
    } finally {
      setSearchLoading(false);
    }
  };

  const extractChatToTable = async (assistantContent: string) => {
    setIsExtracting(true);
    setExtractedFromChat(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-provider", {
        body: {
          messages: [
            {
              role: "user",
              content: `Extract all companies, contacts, or leads mentioned in the following text into a JSON array of objects. Use exactly these keys: name (required), website, email, industry, geography, notes. For each entity extract whatever details are present; leave fields empty string if unknown. Return ONLY a valid JSON array, no markdown or explanation.\n\nText:\n${assistantContent}`,
            },
          ],
          stream: false,
          provider: "openai",
          model: "gpt-4o-mini",
        },
      });
      if (error) throw error;
      let raw = (data?.content ?? "").trim();
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (jsonMatch) raw = jsonMatch[0];
      const parsed = JSON.parse(raw) as unknown;
      const rows: ExtractedRow[] = Array.isArray(parsed)
        ? parsed.map((r: any) => ({
            name: String(r.name ?? r.company ?? "").trim() || "Unknown",
            website: r.website ? String(r.website).trim() : undefined,
            email: r.email ? String(r.email).trim() : undefined,
            industry: r.industry ? String(r.industry).trim() : undefined,
            geography: r.geography ? String(r.geography).trim() : undefined,
            notes: r.notes ? String(r.notes).trim() : undefined,
          }))
        : [];
      setExtractedFromChat(rows);
      if (rows.length === 0) toast({ title: "No structured data found", variant: "destructive" });
      else toast({ title: "Extracted", description: `${rows.length} row(s) ready for CSV or CRM.` });
    } catch (err: any) {
      toast({ title: "Extraction failed", description: err?.message ?? "Could not parse response", variant: "destructive" });
      setExtractedFromChat(null);
    } finally {
      setIsExtracting(false);
    }
  };

  const sendExtractedToEnrichment = async (onlyWithoutEmail: boolean) => {
    if (!extractedFromChat?.length) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: "Please sign in", variant: "destructive" });
      return;
    }
    const rows = onlyWithoutEmail
      ? extractedFromChat.filter((r) => !r.email?.trim())
      : extractedFromChat;
    if (rows.length === 0) {
      toast({ title: "No rows to send", description: onlyWithoutEmail ? "All rows have an email." : "No data.", variant: "destructive" });
      return;
    }
    setImporting(true);
    try {
      const inserts = rows.map((r) => ({
        user_id: user.id,
        name: r.name,
        website: r.website || null,
        industry: r.industry || null,
        geography: r.geography || null,
        email: r.email || null,
        source: "import",
        source_metadata: { from: "research_chat" },
        enrichment_status: "pending",
        email_extraction_status: r.website && !r.email ? "pending" : "not_needed",
      }));
      const { error } = await (supabase as any).from("enrichment_queue").insert(inserts);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["enrichment-queue"] });
      toast({
        title: "Sent to Enrichment",
        description: `${rows.length} lead(s) added to Enrichment Queue. Run enrichment on the Enrichment page.`,
      });
    } catch (err: any) {
      toast({ title: "Error", description: err?.message ?? "Failed to add to enrichment", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const sendSearchResultsToEnrichment = async (onlyWithoutEmail: boolean) => {
    if (searchResults.length === 0) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: "Please sign in", variant: "destructive" });
      return;
    }
    const leads = onlyWithoutEmail
      ? searchResults.filter((l) => !getLeadEmail(l))
      : searchResults;
    if (leads.length === 0) {
      toast({ title: "No leads to send", description: onlyWithoutEmail ? "All leads have an email." : "No data.", variant: "destructive" });
      return;
    }
    setImporting(true);
    try {
      const inserts = leads.map((l) => ({
        user_id: user.id,
        name: l.name,
        website: l.website || null,
        industry: l.industry || null,
        geography: l.geography || null,
        email: getLeadEmail(l) || null,
        source: "import",
        source_metadata: { from: "research_chat" },
        enrichment_status: "pending",
        email_extraction_status: l.website && !getLeadEmail(l) ? "pending" : "not_needed",
      }));
      const { error } = await (supabase as any).from("enrichment_queue").insert(inserts);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["enrichment-queue"] });
      toast({
        title: "Sent to Enrichment",
        description: `${leads.length} lead(s) added to Enrichment Queue. Run enrichment on the Enrichment page.`,
      });
    } catch (err: any) {
      toast({ title: "Error", description: err?.message ?? "Failed to add to enrichment", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const formatImportToast = (created: number, merged: number, extra?: string) => {
    const parts: string[] = [];
    if (created > 0) parts.push(`${created} new compan${created === 1 ? "y" : "ies"} added to CRM`);
    if (merged > 0) parts.push(`${merged} row${merged === 1 ? "" : "s"} merged into existing (same or empty website)`);
    const base = parts.length ? parts.join(". ") : "No new companies added.";
    return extra ? `${base}. ${extra}` : base;
  };

  const downloadExtractedCsv = () => {
    if (!extractedFromChat?.length) return;
    const headers = ["name", "website", "email", "industry", "geography", "notes"];
    const rows = extractedFromChat.map((r) =>
      headers.map((h) => {
        const v = (r as any)[h] ?? "";
        return typeof v === "string" && (v.includes(",") || v.includes('"') || v.includes("\n")) ? `"${v.replace(/"/g, '""')}"` : v;
      }).join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `research-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Downloaded", description: "CSV saved." });
  };

  const importExtractedToCrm = async () => {
    if (!extractedFromChat?.length) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: "Please sign in", variant: "destructive" });
      return;
    }
    setImporting(true);
    let created = 0;
    let merged = 0;
    let lastError: string | null = null;
    for (const row of extractedFromChat) {
      try {
        const { data: existing } = await supabase
          .from("companies")
          .select("id")
          .eq("user_id", user.id)
          .ilike("name", row.name)
          .maybeSingle();
        if (existing) {
          if (row.email) {
            const { data: hasContact } = await supabase.from("contacts").select("id").eq("company_id", existing.id).eq("email", row.email).maybeSingle();
            if (!hasContact) {
              await supabase.from("contacts").insert({
                company_id: existing.id,
                name: "Primary",
                email: row.email,
                is_primary_contact: true,
              });
            }
          }
          continue;
        }
        const { data: newCompany, error } = await supabase.from("companies").insert({
          user_id: user.id,
          name: row.name,
          website: row.website || null,
          industry: row.industry || null,
          geography: row.geography || null,
          general_email: row.email || null,
          description: row.notes || null,
          enrichment_data: { source: "research_chat_extract" },
          tags: [COMPANY_SOURCE_TAGS.RESEARCH_CHAT, importCategoryTag?.trim()].filter(Boolean),
        }).select("id").single();
        if (error) {
          lastError = error.message;
          if (error.code === "23505") {
            const { data: existingByWebsite } = row.website
              ? await supabase.from("companies").select("id").eq("user_id", user.id).eq("website", row.website).maybeSingle()
              : await supabase.from("companies").select("id").eq("user_id", user.id).is("website", null).maybeSingle();
            if (existingByWebsite) {
              merged++;
              if (row.email) {
                await supabase.from("contacts").insert({
                  company_id: existingByWebsite.id,
                  name: "Primary",
                  email: row.email,
                  is_primary_contact: true,
                }).then(() => {});
              }
            }
          }
        } else if (newCompany) {
          created++;
          if (row.email) {
            await supabase.from("contacts").insert({
              company_id: newCompany.id,
              name: "Primary",
              email: row.email,
              is_primary_contact: true,
            });
          }
        }
      } catch (e: any) {
        lastError = e?.message ?? "Unknown error";
      }
    }
    const imported = created + merged;
    if (sendIncompleteToEnrichment) {
      const incomplete = extractedFromChat.filter((r) => !r.email?.trim());
      if (incomplete.length > 0) {
        try {
          const inserts = incomplete.map((r) => ({
            user_id: user.id,
            name: r.name,
            website: r.website || null,
            industry: r.industry || null,
            geography: r.geography || null,
            email: null,
            source: "import",
            source_metadata: { from: "research_chat" },
            enrichment_status: "pending",
            email_extraction_status: r.website ? "pending" : "not_needed",
          }));
          const { error } = await (supabase as any).from("enrichment_queue").insert(inserts);
          if (!error) {
            queryClient.invalidateQueries({ queryKey: ["enrichment-queue"] });
            toast({
              title: "Import complete",
              description: formatImportToast(created, merged, `${incomplete.length} lead(s) without email sent to Enrichment Queue.`),
            });
          } else {
            toast({ title: "Import complete", description: formatImportToast(created, merged, `Could not add to Enrichment: ${error.message}.`) });
          }
        } catch (_) {
          toast({ title: "Import complete", description: formatImportToast(created, merged, "Some could not be sent to Enrichment.") });
        }
      } else {
        toast({ title: "Import complete", description: formatImportToast(created, merged) });
      }
    } else {
      toast({ title: "Import complete", description: formatImportToast(created, merged) });
    }
    if (imported === 0 && extractedFromChat.length > 0 && lastError) {
      toast({
        title: "Why 0 added?",
        description: lastError,
        variant: "destructive",
      });
    }
    setImporting(false);
    queryClient.invalidateQueries({ queryKey: ["companies"] });
    setExtractedFromChat(null);
  };

  const getLeadEmail = (lead: SearchLead): string | null => {
    const email =
      lead.generalEmail ??
      (lead as any).general_email ??
      lead.primaryContact?.email ??
      lead.contacts?.[0]?.email;
    return email && String(email).trim() ? String(email).trim() : null;
  };

  const handleImportToCrm = async () => {
    if (searchResults.length === 0) {
      toast({ title: "No leads to import", variant: "destructive" });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: "Please sign in", variant: "destructive" });
      return;
    }

    setImporting(true);
    let created = 0;
    let merged = 0;
    let lastError: string | null = null;

    for (const lead of searchResults) {
      try {
        const { data: existing } = await supabase
          .from("companies")
          .select("id")
          .eq("user_id", user.id)
          .ilike("name", lead.name)
          .maybeSingle();

        let companyId: string | null = null;

        if (existing) {
          companyId = existing.id;
        } else {
          const { data: newCompany, error } = await supabase
            .from("companies")
            .insert({
              user_id: user.id,
              name: lead.name,
              website: lead.website || null,
              industry: lead.industry || null,
              geography: lead.geography || null,
              general_email: getLeadEmail(lead),
              description: lead.description || null,
              enrichment_data: { source: "research_chat" },
              tags: [COMPANY_SOURCE_TAGS.RESEARCH_CHAT, importCategoryTag?.trim()].filter(Boolean),
            })
            .select("id")
            .single();

          if (error) {
            lastError = error.message;
            if (error.code === "23505") {
              const { data: existingByWebsite } = lead.website
                ? await supabase.from("companies").select("id").eq("user_id", user.id).eq("website", lead.website).maybeSingle()
                : await supabase.from("companies").select("id").eq("user_id", user.id).is("website", null).maybeSingle();
              if (existingByWebsite) {
                companyId = existingByWebsite.id;
                merged++;
              }
            }
          }
          if (!error && newCompany) {
            companyId = newCompany.id;
            created++;
          }
        }

        if (companyId) {
          const email = getLeadEmail(lead);
          const contacts = lead.contacts?.length
            ? lead.contacts
            : lead.primaryContact
              ? [lead.primaryContact]
              : email
                ? [{ name: "Primary", email }]
                : [];

          for (const c of contacts) {
            if (!c?.email) continue;
            const { data: existingContact } = await supabase
              .from("contacts")
              .select("id")
              .eq("company_id", companyId)
              .eq("email", c.email)
              .maybeSingle();
            if (!existingContact) {
              await supabase.from("contacts").insert({
                company_id: companyId,
                name: c.name || "Contact",
                email: c.email,
                is_primary_contact: c === (lead.primaryContact || contacts[0]),
              });
            }
          }
        }
      } catch (err) {
        console.error("Import error:", err);
      }
    }

    setImporting(false);
    queryClient.invalidateQueries({ queryKey: ["companies"] });
    toast({
      title: "Import complete",
      description: formatImportToast(created, merged),
    });
    if (created + merged === 0 && searchResults.length > 0 && lastError) {
      toast({
        title: "Why 0 added?",
        description: lastError,
        variant: "destructive",
      });
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl md:max-w-2xl flex flex-col p-0"
      >
        <SheetHeader className="px-6 py-4 border-b shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Research & Leads
          </SheetTitle>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "chat" | "history")} className="flex-1 flex flex-col min-h-0">
          <div className="px-6 pt-2 pb-1 shrink-0">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="chat" className="gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" />
                Chat
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-1.5">
                <History className="h-3.5 w-3.5" />
                History
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="chat" className="flex-1 flex flex-col min-h-0 mt-0 data-[state=inactive]:hidden">
        <ScrollArea className="flex-1 px-4">
          <div ref={scrollRef} className="space-y-6 py-4 pb-8">
            {/* Chat */}
            <section>
              <h3 className="text-sm font-medium flex items-center gap-2 mb-2">
                <MessageSquare className="h-4 w-4" />
                Chat
              </h3>
              <div className="space-y-2 min-h-[120px]">
                {messages.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Ask anything or describe the leads you want, then search below.
                  </p>
                )}
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={cn(
                      "rounded-xl px-4 py-3 text-sm",
                      m.role === "user"
                        ? "bg-primary/10 ml-4"
                        : "mr-4 border border-border/80 bg-card shadow-sm"
                    )}
                  >
                    {m.role === "assistant" ? (
                      <div className="research-chat-content">
                        {formatChatContent(m.content)}
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    )}
                    {m.role === "assistant" && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="mt-3 h-8 text-xs gap-1.5 border-t border-border/60 pt-2 -mb-1 w-full justify-start"
                        onClick={() => extractChatToTable(m.content)}
                        disabled={isExtracting}
                      >
                        {isExtracting ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Table2 className="h-3.5 w-3.5" />
                        )}
                        Extract to table & use in CRM
                      </Button>
                    )}
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Thinking…
                  </div>
                )}
              </div>
              <div className="flex gap-2 mt-2">
                <Textarea
                  placeholder="Type a message…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendChat();
                    }
                  }}
                  className="min-h-[80px] resize-none"
                  disabled={chatLoading}
                />
                <Button
                  size="icon"
                  onClick={handleSendChat}
                  disabled={!input.trim() || chatLoading}
                  className="shrink-0 h-9 w-9"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </section>

            {/* Extracted from chat → table + CSV + CRM */}
            {extractedFromChat && extractedFromChat.length > 0 && (
              <section>
                <h3 className="text-sm font-medium flex items-center gap-2 mb-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  Extracted data ({extractedFromChat.length} rows)
                </h3>
                <ScrollArea className="h-[200px] rounded border">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-2 font-medium">Name</th>
                        <th className="text-left p-2 font-medium">Website</th>
                        <th className="text-left p-2 font-medium">Email</th>
                        <th className="text-left p-2 font-medium">Industry</th>
                      </tr>
                    </thead>
                    <tbody>
                      {extractedFromChat.slice(0, 50).map((r, j) => (
                        <tr key={j} className="border-b">
                          <td className="p-2 truncate max-w-[120px]">{r.name}</td>
                          <td className="p-2 truncate max-w-[100px]">{r.website ?? "—"}</td>
                          <td className="p-2 truncate max-w-[120px]">{r.email ?? "—"}</td>
                          <td className="p-2 truncate max-w-[80px]">{r.industry ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
                {extractedFromChat.length > 50 && (
                  <p className="text-xs text-muted-foreground mt-1">Showing first 50 of {extractedFromChat.length}</p>
                )}
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" size="sm" className="gap-1.5" title="Add to category for campaign targeting">
                        Category: {importCategoryTag ? <Badge variant="secondary" className="font-normal text-xs">{importCategoryTag}</Badge> : "Optional"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72" align="start">
                      <div className="space-y-2">
                        <Label className="text-xs">Add to category (optional)</Label>
                        <Input
                          placeholder="e.g. Healthcare Sales"
                          value={importCategoryTag}
                          onChange={(e) => setImportCategoryTag(e.target.value)}
                          list="research-chat-category-list"
                          className="h-8 text-sm"
                        />
                        <datalist id="research-chat-category-list">
                          {(categoryTagSuggestions || []).slice(0, 30).map((tag) => (
                            <option key={tag} value={tag} />
                          ))}
                        </datalist>
                        {importCategoryTag && <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setImportCategoryTag("")}>Clear</Button>}
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Button type="button" variant="outline" size="sm" onClick={downloadExtractedCsv} className="flex-1 min-w-0">
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    Download CSV
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => sendExtractedToEnrichment(false)} disabled={importing} className="flex-1 min-w-0" title="Enrich and extract emails before CRM">
                    {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
                    Send to Enrichment
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => sendExtractedToEnrichment(true)} disabled={importing || !extractedFromChat.some((r) => !r.email?.trim())} title="Send only rows without email">
                    Send to Enrichment (no email only)
                  </Button>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Checkbox
                      id="send-incomplete-to-enrichment"
                      checked={sendIncompleteToEnrichment}
                      onCheckedChange={(v) => setSendIncompleteToEnrichment(!!v)}
                    />
                    <Label htmlFor="send-incomplete-to-enrichment" className="text-xs cursor-pointer whitespace-nowrap">
                      Send leads without email to Enrichment Queue
                    </Label>
                  </div>
                  <Button type="button" size="sm" onClick={importExtractedToCrm} disabled={importing} className="flex-1 min-w-0">
                    {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Building2 className="h-3.5 w-3.5 mr-1.5" />}
                    Import to CRM
                  </Button>
                </div>
                <Button type="button" variant="ghost" size="sm" className="mt-1 text-muted-foreground" onClick={() => setExtractedFromChat(null)}>
                  Dismiss
                </Button>
              </section>
            )}

            {/* Search */}
            <section>
              <h3 className="text-sm font-medium flex items-center gap-2 mb-2">
                <Search className="h-4 w-4" />
                Search leads
              </h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. IT agencies in London"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <Button
                  onClick={runSearch}
                  disabled={searchLoading}
                  size="sm"
                  className="shrink-0"
                >
                  {searchLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Search"
                  )}
                </Button>
              </div>
              {searchResults.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    {searchResults.length} lead(s) — import to CRM below
                  </p>
                  <ul className="space-y-1.5">
                    {searchResults.map((lead, i) => (
                      <li
                        key={i}
                        className="flex items-center gap-2 rounded border p-2 text-sm"
                      >
                        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0 flex-1">
                          <span className="font-medium truncate block">
                            {lead.name}
                          </span>
                          {lead.website && (
                            <span className="text-muted-foreground text-xs truncate block">
                              {lead.website}
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            {/* Import */}
            {searchResults.length > 0 && (
              <section>
                <h3 className="text-sm font-medium flex items-center gap-2 mb-2">
                  <Download className="h-4 w-4" />
                  Import to CRM or Enrichment
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" size="sm" className="gap-1.5">
                        Category: {importCategoryTag ? <Badge variant="secondary" className="font-normal text-xs">{importCategoryTag}</Badge> : "Optional"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72" align="start">
                      <div className="space-y-2">
                        <Label className="text-xs">Add to category (optional)</Label>
                        <Input
                          placeholder="e.g. Healthcare Sales"
                          value={importCategoryTag}
                          onChange={(e) => setImportCategoryTag(e.target.value)}
                          list="research-chat-category-list-search"
                          className="h-8 text-sm"
                        />
                        <datalist id="research-chat-category-list-search">
                          {(categoryTagSuggestions || []).slice(0, 30).map((tag) => (
                            <option key={tag} value={tag} />
                          ))}
                        </datalist>
                        {importCategoryTag && <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setImportCategoryTag("")}>Clear</Button>}
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => sendSearchResultsToEnrichment(false)}
                    disabled={importing}
                  >
                    {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
                    Send to Enrichment
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => sendSearchResultsToEnrichment(true)}
                    disabled={importing || searchResults.every((l) => getLeadEmail(l))}
                    title="Send only leads without email"
                  >
                    Send to Enrichment (no email only)
                  </Button>
                  <Button
                    onClick={handleImportToCrm}
                    disabled={importing}
                    className="flex-1 min-w-0"
                  >
                    {importing ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Import {searchResults.length} lead(s) to CRM
                  </Button>
                </div>
              </section>
            )}
          </div>
        </ScrollArea>
          </TabsContent>

          <TabsContent value="history" className="flex-1 mt-0 px-6 py-4 data-[state=inactive]:hidden">
            <div className="space-y-4">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <History className="h-4 w-4" />
                Conversation history
              </h3>
              <p className="text-sm text-muted-foreground">
                Your Research Chat messages are saved automatically and kept for {RESEARCH_CHAT_HISTORY_DAYS} days.
              </p>
              {historyLoadError && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3 text-sm text-amber-800 dark:text-amber-200">
                  History could not be loaded. If you use a hosted database, run the &quot;Research Chat history&quot; migration (table <code className="text-xs">research_chat_history</code>) so your conversation is saved.
                </div>
              )}
              {!historyLoadError && historyUpdatedAt && (
                <p className="text-xs text-muted-foreground">
                  Last saved: {new Date(historyUpdatedAt).toLocaleString()}
                </p>
              )}
              {!historyLoadError && messages.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {messages.length} message(s) in this conversation
                </p>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearHistory}
                className="gap-2"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear history & start fresh
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
