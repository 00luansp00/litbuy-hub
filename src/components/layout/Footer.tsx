import { Link } from "@tanstack/react-router";
import { Facebook, Instagram, Twitter, Youtube, Github } from "lucide-react";
import { Logo } from "@/components/common/Logo";

const columns: { title: string; links: { label: string; to: string }[] }[] = [
  {
    title: "Navegue",
    links: [
      { label: "Categorias", to: "/" },
      { label: "Buscar", to: "/buscar" },
      { label: "Como comprar", to: "/como-comprar" },
      { label: "Como vender", to: "/como-vender" },
    ],
  },
  {
    title: "Confiança",
    links: [
      { label: "Segurança", to: "/seguranca" },
      { label: "Política de reembolso", to: "/politica-de-reembolso" },
      { label: "Itens proibidos", to: "/itens-proibidos" },
      { label: "Regras da plataforma", to: "/regras-da-plataforma" },
    ],
  },
  {
    title: "Institucional",
    links: [
      { label: "Ajuda", to: "/ajuda" },
      { label: "Taxas e prazos", to: "/taxas" },
      { label: "LIT Points", to: "/lit-points" },
      { label: "Afiliados", to: "/afiliados" },
      { label: "Termos de uso", to: "/termos" },
      { label: "Privacidade", to: "/privacidade" },
      { label: "Contato", to: "/contato" },
    ],
  },
];

const socials = [
  { icon: Instagram, label: "Instagram" },
  { icon: Twitter, label: "Twitter" },
  { icon: Facebook, label: "Facebook" },
  { icon: Youtube, label: "YouTube" },
  { icon: Github, label: "GitHub" },
];

export function Footer() {
  return (
    <footer className="mt-24 border-t border-border bg-surface/40">
      <div className="container-lit py-14 grid gap-10 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="space-y-4 max-w-sm">
          <Logo />
          <p className="text-sm text-muted-foreground">
            O marketplace premium para gamers e criadores digitais. Compre e venda com
            segurança, com pagamento protegido e entrega instantânea.
          </p>
          <div className="flex items-center gap-2">
            {socials.map(({ icon: Icon, label }) => (
              <a
                key={label}
                href="#"
                aria-label={label}
                className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground hover:border-primary/50"
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>

        {columns.map((col) => (
          <div key={col.title}>
            <h4 className="text-sm font-semibold text-foreground mb-4">{col.title}</h4>
            <ul className="space-y-2.5">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link
                    to={l.to}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-border">
        <div className="container-lit py-5 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} LIT Buy. Todos os direitos reservados.</span>
          <span>Feito com foco em performance, segurança e experiência.</span>
        </div>
      </div>
    </footer>
  );
}
