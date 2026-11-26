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
