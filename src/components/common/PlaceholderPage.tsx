import { Link } from "@tanstack/react-router";
import { icons, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PlaceholderPageProps {
  title: string;
  description?: string;
  icon?: keyof typeof icons;
}

export function PlaceholderPage({
  title,
  description = "Esta seção está sendo cuidadosamente construída e estará disponível em breve.",
  icon,
}: PlaceholderPageProps) {
  const Icon = icon ? icons[icon] : Sparkles;

  return (
    <div className="container-lit min-h-[70vh] flex items-center justify-center py-20">
      <div className="max-w-xl text-center">
        <div
          className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-2xl shadow-elegant"
          style={{ backgroundImage: "var(--gradient-primary)" }}
        >
          <Icon className="h-7 w-7 text-primary-foreground" />
        </div>
        <span className="inline-block text-xs font-medium uppercase tracking-widest text-muted-foreground mb-3">
          Em construção
        </span>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">{title}</h1>
        <p className="text-muted-foreground mb-8">{description}</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild>
            <Link to="/">Voltar para a home</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/categoria/$slug" params={{ slug: "contas" }}>
              Explorar categorias
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
