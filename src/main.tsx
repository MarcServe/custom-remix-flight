import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App.tsx";
import "./index.css";

Sentry.init({
  dsn: "https://a7b7fa8bcdb1b1d9b6f11fe0457e949e@o4510300644179968.ingest.de.sentry.io/4510300645556304",
  environment: import.meta.env.MODE,
  tracesSampleRate: 1.0,
  sendDefaultPii: true,
});

createRoot(document.getElementById("root")!).render(<App />);
