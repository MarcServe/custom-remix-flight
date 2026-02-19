import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

type ResearchChatContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
};

const ResearchChatContext = createContext<ResearchChatContextValue | null>(null);

export function ResearchChatProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((prev) => !prev), []);
  return (
    <ResearchChatContext.Provider value={{ open, setOpen, toggle }}>
      {children}
    </ResearchChatContext.Provider>
  );
}

export function useResearchChat() {
  const ctx = useContext(ResearchChatContext);
  if (!ctx) {
    throw new Error("useResearchChat must be used within ResearchChatProvider");
  }
  return ctx;
}
