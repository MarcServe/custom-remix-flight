import * as Sentry from "@sentry/react";

const dsn =
  import.meta.env.VITE_SENTRY_DSN ??
  "https://369d4ed036afbdbfb47eca58325ee229@o4510300644179968.ingest.de.sentry.io/4510300658663504";

const integrations: any[] = [];
const sentryAny = Sentry as unknown as {
  browserTracingIntegration?: (...args: any[]) => any;
  BrowserTracing?: new (...args: any[]) => any;
};

if (typeof sentryAny.browserTracingIntegration === "function") {
  integrations.push(sentryAny.browserTracingIntegration());
} else if (sentryAny.BrowserTracing) {
  integrations.push(new sentryAny.BrowserTracing());
}

Sentry.init({
  dsn,
  integrations,
  tracesSampleRate: Number(
    import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? "1.0"
  ),
  tracePropagationTargets: ["localhost", /^https:\/\/yourserver\.io\/api/],
});

export {}; // ensure this module is treated as a side-effect module

