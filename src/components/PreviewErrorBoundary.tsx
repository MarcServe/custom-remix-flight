import { Component, type ErrorInfo, type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/** Catches errors in the email preview only so the rest of the page still loads. */
export class PreviewErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("PreviewErrorBoundary – full error:", error);
    console.error("PreviewErrorBoundary – stack:", error.stack);
    console.error("PreviewErrorBoundary – componentStack:", errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500 mb-2">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span className="font-medium">Preview unavailable</span>
            </div>
            <p className="text-sm text-muted-foreground">
              The template preview could not be rendered. You can still edit and save your branding below. Check the browser console (F12) for details.
            </p>
            <button
              type="button"
              className="mt-3 text-sm text-primary hover:underline"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Try again
            </button>
          </CardContent>
        </Card>
      );
    }
    return this.props.children;
  }
}
