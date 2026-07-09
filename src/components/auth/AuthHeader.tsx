interface AuthHeaderProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
}

export function AuthHeader({ title, subtitle, eyebrow }: AuthHeaderProps) {
  return (
    <div className="text-center">
      {eyebrow ? (
        <span className="inline-block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {eyebrow}
        </span>
      ) : null}
      <h1 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight">
        {title}
      </h1>
      {subtitle ? (
        <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
      ) : null}
    </div>
  );
}
