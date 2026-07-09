import type { ReactNode } from "react";

export function FormFooter({ children }: { children: ReactNode }) {
  return (
    <div className="mt-6 border-t border-border pt-4 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}
