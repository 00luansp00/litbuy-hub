import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

interface SectionTitleProps {
  eyebrow?: string;
  title: ReactNode;
  description?: string;
  href?: string;
  actionLabel?: string;
}

export function SectionTitle({
  eyebrow,
  title,
  description,
  href,
  actionLabel = "Ver tudo",
}: SectionTitleProps) {
  return (
    <div className="flex items-end justify-between gap-6 mb-6 md:mb-8">
      <div className="space-y-2">
        {eyebrow && (
          <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {eyebrow}
          </span>
        )}
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h2>
        {description && (
          <p className="text-sm md:text-base text-muted-foreground max-w-2xl">
            {description}
          </p>
        )}
      </div>
      {href && (
        <Link
          to={href}
          className="hidden md:inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          {actionLabel}
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}
