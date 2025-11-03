import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-gradient-primary text-foreground shadow-md hover:opacity-90 hover:scale-105 hover:shadow-lg",
        destructive: "bg-destructive text-destructive-foreground shadow-md hover:bg-destructive/90 hover:scale-105",
        outline: "border-2 border-primary/30 bg-background hover:bg-gradient-primary hover:text-foreground hover:border-primary/50 hover:scale-105",
        secondary: "bg-gradient-secondary text-foreground shadow-md hover:opacity-90 hover:scale-105 hover:shadow-lg",
        ghost: "hover:bg-primary/20 hover:text-foreground hover:scale-105",
        link: "text-primary underline-offset-4 hover:underline",
        accent: "bg-gradient-accent text-white shadow-md hover:opacity-90 hover:scale-105 hover:shadow-lg",
        success: "bg-gradient-success text-success-foreground shadow-md hover:opacity-90 hover:scale-105 hover:shadow-lg",
        warm: "bg-gradient-warm text-foreground shadow-md hover:opacity-90 hover:scale-105 hover:shadow-lg",
        glow: "bg-gradient-primary text-foreground shadow-[0_4px_15px_hsl(280_30%_80%/0.3)] hover:shadow-[0_6px_25px_hsl(280_30%_80%/0.5)] hover:-translate-y-0.5 hover:scale-105",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3 text-xs",
        lg: "h-12 rounded-lg px-8 text-base font-semibold",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
