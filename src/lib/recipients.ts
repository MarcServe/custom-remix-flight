import { supabase } from "@/integrations/supabase/client";
import { selectInChunks } from "@/lib/chunkedIn";

export type Recipient = {
  id: string; first_name: string; last_name: string; email: string; company_id?: string;
  companies?: { id?: string; name?: string; tags?: string[] };
};
export type Progress = (message: string) => void;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Turns selected people and/or companies into campaign recipients, de-duplicated by email.
 * Companies contribute every person with an email plus their own contact/general address
 * (a person record is created for it when missing). All lookups are chunked and inserts
 * batched, so thousands of companies take seconds rather than minutes.
 */
export async function resolveRecipients(
  sel: { personIds?: string[]; companyIds?: string[] },
  onProgress?: Progress,
): Promise<Recipient[]> {
  const personIds = [...new Set(sel.personIds || [])];
  const companyIds = [...new Set(sel.companyIds || [])];
  const merged: Recipient[] = [];
  const seen = new Set<string>();
  const push = (r: Recipient) => {
    const k = String(r.email || "").toLowerCase().trim();
    if (!k || !EMAIL_RE.test(k) || seen.has(k)) return;
    seen.add(k); merged.push(r);
  };

  if (personIds.length) {
    onProgress?.(`Loading ${personIds.length} selected people…`);
    const people = await selectInChunks(personIds, (ids) => supabase.from("people")
      .select("id, first_name, last_name, email, company_id, companies(id, name, tags)").in("id", ids));
    for (const p of people as any[]) push({ id: p.id, first_name: p.first_name ?? "", last_name: p.last_name ?? "", email: p.email, company_id: p.company_id, companies: p.companies });
  }

  if (companyIds.length) {
    const { data: { user } } = await supabase.auth.getUser();
    onProgress?.(`Loading contacts for ${companyIds.length.toLocaleString()} companies…`);
    const byCompany = await selectInChunks(companyIds, (ids) => supabase.from("people")
      .select("id, first_name, last_name, email, company_id, companies(id, name, tags)").in("company_id", ids).not("email", "is", null));
    for (const p of byCompany as any[]) push({ id: p.id, first_name: p.first_name ?? "", last_name: p.last_name ?? "", email: p.email, company_id: p.company_id, companies: p.companies });

    onProgress?.(`Checking company email addresses (${merged.length.toLocaleString()} found so far)…`);
    const companies = await selectInChunks(companyIds, (ids) => supabase.from("companies")
      .select("id, name, tags, general_email, contacts(name, email)").in("id", ids));
    const pending: { company: any; email: string; contactName?: string }[] = [];
    for (const company of companies as any[]) {
      const contact = company.contacts?.find((c: any) => c.email && EMAIL_RE.test(String(c.email).trim()));
      // general_email sometimes holds several addresses separated by , or ;
      const candidates = [contact?.email, ...String(company.general_email || "").split(/[,;]+/)]
        .map((e) => String(e || "").trim()).filter((e) => EMAIL_RE.test(e));
      const email = candidates.find((e) => !seen.has(e.toLowerCase()));
      if (!email) continue;
      seen.add(email.toLowerCase());
      pending.push({ company, email, contactName: contact?.name });
    }
    if (pending.length) {
      const lookup = [...new Set(pending.flatMap((p) => [p.email, p.email.toLowerCase()]))];
      const existing = await selectInChunks(lookup, (ids) => supabase.from("people")
        .select("id, first_name, last_name, email, company_id, companies(id, name, tags)").in("email", ids), 100);
      const byEmail = new Map<string, any>();
      for (const p of existing as any[]) if (p.email) byEmail.set(String(p.email).toLowerCase().trim(), p);
      const toCreate: { row: any; company: any }[] = [];
      for (const { company, email, contactName } of pending) {
        const info = { id: company.id, name: company.name, tags: company.tags || [] };
        const found = byEmail.get(email.toLowerCase());
        if (found) merged.push({ id: found.id, first_name: found.first_name ?? "", last_name: found.last_name ?? "", email: found.email, company_id: company.id, companies: found.companies ?? info });
        else if (user) {
          const parts = String(contactName || company.name || "").trim().split(" ");
          toCreate.push({ company, row: { first_name: parts[0] || company.name, last_name: parts.slice(1).join(" ") || "", email: email.toLowerCase(), company_id: company.id, user_id: user.id } });
        }
      }
      for (let i = 0; i < toCreate.length; i += 200) {
        onProgress?.(`Saving new contacts ${i + 1}–${Math.min(i + 200, toCreate.length)} of ${toCreate.length}…`);
        const batch = toCreate.slice(i, i + 200);
        const { data: created, error } = await supabase.from("people").insert(batch.map((b) => b.row)).select("id, first_name, last_name, email, company_id");
        if (error) throw error;
        const byId = new Map(batch.map((b) => [b.company.id, b.company]));
        for (const n of (created || []) as any[]) {
          const c = byId.get(n.company_id);
          merged.push({ id: n.id, first_name: n.first_name ?? "", last_name: n.last_name ?? "", email: n.email, company_id: n.company_id, companies: c ? { id: c.id, name: c.name, tags: c.tags || [] } : undefined });
        }
      }
    }
  }
  return merged;
}

/** Every company id in the signed-in user's CRM (paged; PostgREST caps a request at 1,000 rows). */
export async function allCompanyIds(): Promise<string[]> {
  const ids: string[] = [];
  for (let from = 0; from < 100_000; from += 1000) {
    const { data, error } = await supabase.from("companies").select("id").order("created_at").range(from, from + 999);
    if (error) throw error;
    ids.push(...(data || []).map((r: any) => r.id));
    if (!data || data.length < 1000) break;
  }
  return ids;
}

// ── Tab-to-tab hand-off (Companies / People → an open campaign composer) ─────────────
// BroadcastChannel reaches every LeadBoosters tab in this browser, with or without
// window.opener, and carries the ids in the message (no storage quota involved).
// The composer acknowledges, reports progress and confirms the final count.
export const RECIPIENT_CHANNEL = "leadboosters-recipients";
export type HandoffMode = "add" | "replace";
export type HandoffMessage =
  | { type: "ping"; from: string }
  | { type: "pong"; to: string; campaign?: string }
  | { type: "deliver"; id: string; mode: HandoffMode; companyIds?: string[]; personIds?: string[] }
  | { type: "accepted"; id: string }
  | { type: "progress"; id: string; message: string }
  | { type: "done"; id: string; added: number; total: number }
  | { type: "failed"; id: string; message: string };

const channel = () => (typeof window !== "undefined" && "BroadcastChannel" in window ? new BroadcastChannel(RECIPIENT_CHANNEL) : null);

/** Asks other tabs whether a campaign composer is open. Resolves its name, or null. */
export function findOpenCampaign(timeoutMs = 700): Promise<string | null> {
  return new Promise((resolve) => {
    const ch = channel(); if (!ch) return resolve(null);
    const me = Math.random().toString(36).slice(2);
    const t = setTimeout(() => { ch.close(); resolve(null); }, timeoutMs);
    ch.onmessage = (e) => { const m = e.data as HandoffMessage; if (m?.type === "pong" && m.to === me) { clearTimeout(t); ch.close(); resolve(m.campaign || "your campaign"); } };
    ch.postMessage({ type: "ping", from: me } as HandoffMessage);
  });
}

/**
 * Sends a selection to the open composer and streams its progress back.
 * Resolves "done" / "failed", or "no-campaign" if no composer acknowledged within 1.5 s.
 */
export function deliverToCampaign(
  sel: { companyIds?: string[]; personIds?: string[] }, mode: HandoffMode,
  on: { progress?: (msg: string) => void; done?: (added: number, total: number) => void; failed?: (msg: string) => void },
): Promise<"done" | "failed" | "no-campaign"> {
  return new Promise((resolve) => {
    const ch = channel(); if (!ch) return resolve("no-campaign");
    const id = Math.random().toString(36).slice(2);
    let accepted = false;
    const ackTimer = setTimeout(() => { if (!accepted) { ch.close(); resolve("no-campaign"); } }, 1500);
    ch.onmessage = (e) => {
      const m = e.data as HandoffMessage;
      if (!m || (m as any).id !== id) return;
      if (m.type === "accepted") { accepted = true; clearTimeout(ackTimer); on.progress?.("Your campaign tab is adding them…"); }
      else if (m.type === "progress") on.progress?.(m.message);
      else if (m.type === "done") { ch.close(); on.done?.(m.added, m.total); resolve("done"); }
      else if (m.type === "failed") { ch.close(); on.failed?.(m.message); resolve("failed"); }
    };
    ch.postMessage({ type: "deliver", id, mode, ...sel } as HandoffMessage);
  });
}

/** Composer side: answer pings and accept deliveries while mounted. Returns a cleanup. */
export function listenForDeliveries(
  campaignName: () => string,
  handle: (msg: Extract<HandoffMessage, { type: "deliver" }>, report: { progress: (m: string) => void; done: (added: number, total: number) => void; failed: (m: string) => void }) => void,
): () => void {
  const ch = channel(); if (!ch) return () => {};
  ch.onmessage = (e) => {
    const m = e.data as HandoffMessage;
    if (m?.type === "ping") ch.postMessage({ type: "pong", to: m.from, campaign: campaignName() } as HandoffMessage);
    if (m?.type === "deliver") {
      ch.postMessage({ type: "accepted", id: m.id } as HandoffMessage);
      handle(m, {
        progress: (message) => ch.postMessage({ type: "progress", id: m.id, message } as HandoffMessage),
        done: (added, total) => ch.postMessage({ type: "done", id: m.id, added, total } as HandoffMessage),
        failed: (message) => ch.postMessage({ type: "failed", id: m.id, message } as HandoffMessage),
      });
    }
  };
  return () => ch.close();
}

type ToastFn = (opts: any) => { id: string; update: (o: any) => void; dismiss: () => void };

/**
 * Companies / People side: hand a selection to the open campaign tab with live feedback.
 * Falls back to saving it locally (the composer's Add button picks it up) when no campaign
 * tab answers.
 */
export async function sendSelectionToCampaign(
  toast: ToastFn, sel: { companyIds?: string[]; personIds?: string[] }, mode: HandoffMode, what: string,
): Promise<void> {
  const label = mode === "replace" ? "Replacing your campaign's recipients…" : "Adding to your campaign…";
  const t = toast({ title: label, description: `Sending ${what} to your campaign tab.` });
  const result = await deliverToCampaign(sel, mode, {
    progress: (m) => t.update({ id: t.id, title: label, description: m }),
    done: (added, total) => t.update({ id: t.id, title: "Added to your campaign", description: mode === "replace"
      ? `Your campaign now has ${total.toLocaleString()} recipient(s). Switch back to that tab and save the draft.`
      : `${added.toLocaleString()} new recipient(s) added (duplicates removed); ${total.toLocaleString()} in the campaign now. Switch back to that tab and save the draft.` }),
    failed: (m) => t.update({ id: t.id, title: "Your campaign couldn't add them", description: m, variant: "destructive" }),
  });
  if (result === "no-campaign") {
    try {
      localStorage.removeItem("leadboosters_draft_recipients");
      localStorage.setItem("leadboosters_selected_company_ids", JSON.stringify(sel.companyIds || []));
      localStorage.setItem("leadboosters_selected_people_ids", JSON.stringify(sel.personIds || []));
      t.update({ id: t.id, title: "No open campaign found", description: `Your selection is saved. Open a campaign and click ${mode === "replace" ? "Replace All" : "Add"} under Selected Recipients to load it.` });
    } catch {
      t.update({ id: t.id, title: "No open campaign found", description: "Open the campaign first, then use its \"Add all companies\" or Open Companies button.", variant: "destructive" });
    }
  }
}

/** Polls for an open campaign composer (on mount and when the tab regains focus). */
export function watchForOpenCampaign(onChange: (name: string | null) => void): () => void {
  let alive = true;
  const check = () => { findOpenCampaign().then((n) => { if (alive) onChange(n); }); };
  check();
  window.addEventListener("focus", check);
  const iv = window.setInterval(check, 15000);
  return () => { alive = false; window.removeEventListener("focus", check); window.clearInterval(iv); };
}
