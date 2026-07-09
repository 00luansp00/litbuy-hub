import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AuthCardProps {
  children: ReactNode;
  className?: string;
}

export function AuthCard({ children, className }: AuthCardProps) {
  return (
    <div
      className={cn(
        "relative rounded-2xl border border-border bg-card/80 backdrop-blur-xl shadow-elegant",
        "p-6 sm:p-8",
        className,
      )}
    >
      {children}
    </div>
  );
}
