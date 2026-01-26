import { UseDismissProps, useFloating, UseFloatingOptions, useInteractions, VirtualElement } from "@floating-ui/react";
type UIElementPosition = {
    isMounted: boolean;
    ref: (node: HTMLElement | null) => void;
    style: React.CSSProperties;
    getFloatingProps: ReturnType<typeof useInteractions>["getFloatingProps"];
    getReferenceProps: ReturnType<typeof useInteractions>["getReferenceProps"];
    setReference: ReturnType<typeof useFloating>["refs"]["setReference"];
    isPositioned: boolean;
};
export declare function useUIElementPositioning(show: boolean, referencePos: DOMRect | HTMLElement | VirtualElement | null, zIndex: number, options?: Partial<UseFloatingOptions & {
    canDismiss: boolean | UseDismissProps;
}>): UIElementPosition;
export {};
