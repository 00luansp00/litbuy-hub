import { Link } from "@tanstack/react-router";
import { Zap } from "lucide-react";

interface LogoProps {
  compact?: boolean;
}

export function Logo({ compact = false }: LogoProps) {
  return (
    <Link to="/" className="flex items-center gap-2 group">
      <span
        className="grid place-items-center h-9 w-9 rounded-lg shadow-elegant"
        style={{ backgroundImage: "var(--gradient-primary)" }}
      >
        <Zap className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
      </span>
      {!compact && (
        <span className="text-lg font-semibold tracking-tight">
          LIT<span className="text-gradient font-bold">Buy</span>
        </span>
      )}
    </Link>
  );
}
