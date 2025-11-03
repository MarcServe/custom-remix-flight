import "./sentry/client";
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App.tsx";
import "./index.css";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  
  // Performance Monitoring
  tracesSampleRate: import.meta.env.MODE === "production" ? 0.1 : 1.0,
  
  // Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],
  
  // Send user data
  sendDefaultPii: true,
  
  // Enhanced error filtering
  beforeSend(event, hint) {
    // Don't send errors in development
    if (import.meta.env.MODE === "development") {
      console.error("Sentry Event (dev mode):", event, hint);
      return null;
    }
    
    // Filter out browser extension errors
    if (event.exception?.values?.[0]?.stacktrace?.frames?.some(
      frame => frame.filename?.includes('extension://')
    )) {
      return null;
    }
    
    return event;
  },
});

createRoot(document.getElementById("root")!).render(<App />);
