import { forwardRef } from "react";
import { Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type EmailInputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const EmailInput = forwardRef<HTMLInputElement, EmailInputProps>(
  function EmailInput({ className, ...props }, ref) {
    return (
      <div className="relative">
        <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={ref}
          type="email"
          autoComplete={props.autoComplete ?? "email"}
          className={cn("pl-9 bg-surface", className)}
          {...props}
        />
      </div>
    );
  },
);
