// deno test --allow-read supabase/functions/_shared/primary-and-mcp-fixes.test.ts
// Repro for three production bugs found 25 Nov 2026 (ROUT£ / TalkWeb outreach set-up).
import { assert, assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { greetingFirstName, isPlaceholderName, personNameParts } from "./email-quality.ts";

const root = new URL("../../", import.meta.url);
const read = (p: string) => Deno.readTextFileSync(new URL(p, root));

// 1) find_leads save=true: autonomous_leads.discovery_run_id is UUID; "assistant-<ts>" was rejected by Postgres.
Deno.test("find_leads saves with a uuid discovery_run_id", () => {
  const leads = read("functions/api-campaigns/leads.ts");
  assert(!/`assistant-\$\{Date\.now\(\)\}`/.test(leads), "find_leads still builds a non-uuid run id");
  const mig = read("migrations/20251231151929_e2e56fa9-a35d-4edb-8ef3-5a3bbdb3360d.sql");
  assert(/discovery_run_id UUID/.test(mig));
  const m = leads.match(/const runId = (.+);/);
  assertEquals(m?.[1], "crypto.randomUUID()");
  assert(/^[0-9a-f-]{36}$/.test(crypto.randomUUID()));
});

// 2) "Hi Primary,": role / placeholder labels never become a first name.
Deno.test("placeholder labels are not first names", () => {
  for (const n of ["Primary", "primary", "PRIMARY", "Contact", "Info", "Admin", "Sales", "Enquiries", "Hello", "Team", "Office", "General enquiries", "Hiring Manager"]) {
    assertEquals(greetingFirstName(n), "there", n);
    assertEquals(personNameParts(n), { first_name: null, last_name: null }, n);
    assert(isPlaceholderName(n), n);
  }
  assertEquals(personNameParts("Sarah Jones", { email: "sarah@acme.com" }), { first_name: "Sarah", last_name: "Jones" });
  assertEquals(greetingFirstName("Sarah Jones"), "Sarah");
  assert(!isPlaceholderName("Sarah"));
});

Deno.test("Autopilot no longer names the general-inbox contact 'Primary'", () => {
  const src = read("functions/autonomous-lead-discovery/index.ts");
  assert(!/name:\s*'Primary'/.test(src));
});

// 3) update_enrollment status=completed wrote next_action "stopped_manually", violating
//    company_sequences_next_action_check.
Deno.test("update_enrollment only writes next_action values the check constraint allows", () => {
  const mig = read("migrations/20251101122222_d20f14de-49b2-444c-b7f4-7fcb13e29ec6.sql");
  const allowed = new Set([...mig.match(/next_action IN \(([^)]+)\)/)![1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]));
  const crm = read("functions/api-campaigns/crm.ts");
  const block = crm.slice(crm.indexOf('case "update_enrollment"'), crm.indexOf('case "run_sequences_now"'));
  const written = [...block.matchAll(/next_action:\s*"([a-z_]+)"/g)].map((x) => x[1]);
  assert(written.includes("completed"));
  for (const v of written) assert(allowed.has(v), `next_action "${v}" violates company_sequences_next_action_check`);
});

// 4) enroll_in_sequence: every new recipient was "skipped_invalid". companies.website is
//    UNIQUE NULLS NOT DISTINCT, so ensurePersonCompany's insert with no website hit 23505 every time.
import { ensurePersonCompany } from "./followup.ts";

/* eslint-disable @typescript-eslint/no-explicit-any -- loose fake of the supabase query builder */
/** Tiny in-memory stand-in for the supabase client that enforces companies_website_unique (NULLS NOT DISTINCT). */
function fakeDb() {
  const t: Record<string, any[]> = { people: [], companies: [{ id: "existing-null", user_id: "other", name: "X", website: null }], contacts: [] };
  const q = (table: string) => {
    const filters: ((r: any) => boolean)[] = []; let pending: any = null; let mode = "select";
    const api: any = {
      select: () => api, limit: () => api, order: () => api,
      eq: (k: string, v: unknown) => { filters.push((r) => r[k] === v); return api; },
      ilike: (k: string, v: string) => { const needle = v.replace(/%/g, "").toLowerCase(); filters.push((r) => String(r[k] ?? "").toLowerCase().includes(needle)); return api; },
      insert: (row: any) => { mode = "insert"; pending = row; return api; },
      update: () => { mode = "update"; return api; },
      run: () => {
        if (mode === "insert") {
          if (table === "companies" && t.companies.some((c) => (c.website ?? null) === (pending.website ?? null))) return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint \"companies_website_unique\"" } };
          const row = { id: crypto.randomUUID(), ...pending }; t[table].push(row); return { data: row, error: null };
        }
        const rows = t[table].filter((r) => filters.every((f) => f(r))); return { data: rows, error: null };
      },
      single: () => Promise.resolve((() => { const r = api.run(); return Array.isArray(r.data) ? { data: r.data[0] ?? null, error: r.error } : r; })()),
      maybeSingle: () => api.single(),
      then: (res: any, rej: any) => Promise.resolve(api.run()).then(res, rej),
    };
    return api;
  };
  return { db: { from: q }, t };
}

Deno.test("enroll: new shop recipients get a company (no NULL-website unique clash)", async () => {
  const { db, t } = fakeDb();
  for (const email of ["info@wildyeastbakery.co.uk", "hello@bakehousebristol.com", "shop@lloydsflowers.co.uk"]) {
    const r = await ensurePersonCompany(db, "u1", { email, company: email.split("@")[1] });
    assert(r.companyId, `${email} got no company → skipped_invalid`);
  }
  assertEquals(t.companies.filter((c) => c.user_id === "u1").map((c) => c.website), ["https://wildyeastbakery.co.uk", "https://bakehousebristol.com", "https://lloydsflowers.co.uk"]);
});

Deno.test("enroll: links an existing CRM company on the same domain instead of duplicating", async () => {
  const { db, t } = fakeDb();
  t.companies.push({ id: "c-wild", user_id: "u1", name: "Wild Yeast Bakery Ltd", website: "https://www.wildyeastbakery.co.uk/" });
  const r = await ensurePersonCompany(db, "u1", { email: "info@wildyeastbakery.co.uk", company: "Wild Yeast" });
  assertEquals(r.companyId, "c-wild");
});

Deno.test("send-sequence-email sends to the enrolment's own recipient when it is known", () => {
  const src = read("functions/send-sequence-email/index.ts");
  const i = src.indexOf("metadata?.recipient_email");
  assert(i > 0, "send-sequence-email ignores metadata.recipient_email");
  assert(i < src.indexOf("const contact = contacts[0]"), "recipient lookup must happen before the contact is chosen");
});
