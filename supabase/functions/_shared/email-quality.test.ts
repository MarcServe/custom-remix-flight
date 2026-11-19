// deno test supabase/functions/_shared/email-quality.test.ts
// Cases are real addresses that bounced from Gmail campaign sends (Nov 2026).
import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { emailRejectReason, greetingFirstName, parseBounce } from "./email-quality.ts";

Deno.test("rejects scraped junk, placeholders and non-sales inboxes", () => {
  for (const e of [
    "footer-logo@2x.png", "shadow@2x.png", "rae-hero2@2x-optimized-1-600x350.jpg",
    "pad192x192@stretch.png", "lets-get-better-2@2x.webp", "logo@1x-bcarn8re.png",
    "artboard-2-copy-29@3x-e1752495660466-100x100.png",
    "test@gmail.com", "example@youremail.com", "jane@example.co.uk", "ex@abc.xyz",
    "filler@godaddy.com", "impallari@gmail.com",
    "jobs@fdrsocialcare.co.uk", "press@longtallsally.com", "recruitment@passion4care.co.uk",
    "noreply@x.com", "a@b", "",
  ]) {
    assertEquals(emailRejectReason(e) !== null, true, `should reject ${e}`);
  }
});

Deno.test("accepts ordinary business and personal addresses", () => {
  for (const e of [
    "info@aamevol-care.com", "client.care@reiss.com", "h.watts@butterflydays.co.uk",
    "acocksgreendental@gmail.com", "enquiries@dreams.co.uk", "Info@RightRecruitmentLtd.com",
  ]) {
    assertEquals(emailRejectReason(e), null, `should accept ${e}`);
  }
});

Deno.test("greets 'there' unless the name looks like a person", () => {
  assertEquals(greetingFirstName("Reiss", { company: "Reiss" }), "there");
  assertEquals(greetingFirstName("Head Office"), "there");
  assertEquals(greetingFirstName("footer"), "there");
  assertEquals(greetingFirstName("Because We Care", { company: "Because We Care Northampton Ltd" }), "there");
  assertEquals(greetingFirstName("Jason", { email: "info@jasonhyltoncourt.co.uk" }), "there");
  assertEquals(greetingFirstName("Contact"), "there");
  assertEquals(greetingFirstName("footer-logo@2x.png"), "there");
  assertEquals(greetingFirstName(""), "there");
  assertEquals(greetingFirstName("Sarah Jones", { company: "Acme Ltd", email: "sarah@acme.com" }), "Sarah");
  assertEquals(greetingFirstName("Helen Watts", { company: "Butterfly Days" }), "Helen");
});

Deno.test("parses Gmail and Office 365 bounce notices", () => {
  const gmail = parseBounce({
    from: "Mail Delivery Subsystem <mailer-daemon@googlemail.com>",
    subject: "Delivery Status Notification (Failure)",
    body: "** Message blocked **\n\nYour message to client.care@reiss.com has been blocked.\n" +
      "Final-Recipient: rfc822; client.care@reiss.com\nAction: failed\nStatus: 5.4.1\n" +
      "Diagnostic-Code: smtp; 550 5.4.1 Recipient address rejected: Access denied.",
  }, ["me@gmail.com"]);
  assertEquals(gmail?.recipient, "client.care@reiss.com");
  assertEquals(gmail?.permanent, true);
  assertEquals(gmail?.reason, "550 5.4.1 Recipient address rejected: Access denied.");

  const o365 = parseBounce({
    from: "postmaster@outlook.com",
    subject: "Undeliverable: Never miss another enquiry",
    body: "Your message to enquiries@dreams.co.uk couldn't be delivered.\nme@gmail.com",
  }, ["me@gmail.com"]);
  assertEquals(o365?.recipient, "enquiries@dreams.co.uk");
  assertEquals(o365?.permanent, true);

  const delay = parseBounce({
    from: "mailer-daemon@googlemail.com",
    subject: "Delivery Status Notification (Delay)",
    body: "Delivery incomplete\nThere was a temporary problem delivering your message to jane@example.co.uk. Gmail will retry for 45 more hours.",
  });
  assertEquals(delay?.permanent, false);

  assertEquals(parseBounce({ from: "Helen <h@x.co.uk>", subject: "Re: Never miss another enquiry", body: "Interested!" }), null);
});
