import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/utils";

type Variant = "primary" | "secondary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", ...props }, ref) => {
    const variantClass = {
      primary: "btn-primary",
      secondary: "btn-secondary",
      ghost: "btn-ghost",
    }[variant];
    return <button ref={ref} className={cn("btn", variantClass, className)} {...props} />;
  }
);
Button.displayName = "Button";
