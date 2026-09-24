import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    ref={ref}
    className={cn(
      [
        // Base
        "peer inline-flex h-6 w-11 shrink-0 items-center",
        "cursor-pointer rounded-full border-2 border-transparent",

        // Colors
        "bg-input",
        "transition-colors",
        "data-[state=checked]:bg-primary",
        "data-[state=unchecked]:bg-input",

        // Focus
        "focus-visible:outline-none",
        "focus-visible:ring-2",
        "focus-visible:ring-ring",
        "focus-visible:ring-offset-2",
        "focus-visible:ring-offset-background",

        // Disabled
        "disabled:cursor-not-allowed",
        "disabled:opacity-50",

        // Accessibility / interaction
        "touch-none select-none",
      ],
      className,
    )}
    {...props}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-5 w-5 rounded-full",
        "bg-background shadow-md ring-0",
        "transition-transform duration-200 ease-in-out",
        "data-[state=checked]:translate-x-5",
        "data-[state=unchecked]:translate-x-0",
        "rtl:data-[state=checked]:-translate-x-5",
      )}
    />
  </SwitchPrimitives.Root>
));

Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };