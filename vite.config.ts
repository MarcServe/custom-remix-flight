import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const sentryPlugin = process.env.SENTRY_AUTH_TOKEN
    ? sentryVitePlugin({
        org: process.env.SENTRY_ORG ?? "biz-boosters-ltd",
        project: process.env.SENTRY_PROJECT ?? "javascript-react",
        authToken: process.env.SENTRY_AUTH_TOKEN,
        telemetry: false,
        sourcemaps: {
          assets: "./dist/**",
        },
      })
    : null;

  return {
    server: {
      host: "127.0.0.1",
      port: 8080,
      strictPort: false,
      open: true,
      hmr: {
        clientPort: 8080,
      },
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
      sentryPlugin,
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      sourcemap: true,
    },
  };
});
