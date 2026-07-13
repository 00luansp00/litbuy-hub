/**
 * Seo — helper documental para SEO em rotas TanStack Start (Sprint 18.20).
 *
 * A LIT Buy é uma SPA/Vite React. Tags <head> geradas apenas no client
 * podem não ser vistas por crawlers e por previews sociais (WhatsApp,
 * Discord, Telegram, Facebook, X/Twitter) sem SSR/SSG. Documentado em
 * ARCHITECTURE.md — recomenda-se avaliar SSR/SSG (Next.js/Remix/prerender)
 * no futuro para páginas públicas (produto, categoria, loja, home,
 * institucionais).
 *
 * Este helper NÃO renderiza um componente — ele monta o objeto que a
 * função `head()` de cada rota espera, mantendo padronização visual sem
 * introduzir libs novas (react-helmet etc.).
 *
 * Uso em rotas:
 *
 *   export const Route = createFileRoute("/produto/$id")({
 *     head: ({ params }) => buildSeoHead({
 *       title: "Produto — LIT Buy",
 *       description: "...",
 *       canonicalPath: `/produto/${params.id}`,
 *     }),
 *     component: ProductPage,
 *   });
 */

export interface SeoOptions {
  title: string;
  description?: string;
  canonicalPath?: string;
  image?: string;
  noIndex?: boolean;
  ogType?: "website" | "article" | "product" | "profile";
  twitterCard?: "summary" | "summary_large_image";
}

export interface SeoHead {
  meta: Array<Record<string, string>>;
  links: Array<Record<string, string>>;
}

export function buildSeoHead(opts: SeoOptions): SeoHead {
  const meta: Array<Record<string, string>> = [
    { title: opts.title },
    { property: "og:title", content: opts.title },
    { name: "twitter:title", content: opts.title },
    { property: "og:type", content: opts.ogType ?? "website" },
    { name: "twitter:card", content: opts.twitterCard ?? "summary_large_image" },
  ];

  if (opts.description) {
    meta.push({ name: "description", content: opts.description });
    meta.push({ property: "og:description", content: opts.description });
    meta.push({ name: "twitter:description", content: opts.description });
  }

  if (opts.image) {
    meta.push({ property: "og:image", content: opts.image });
    meta.push({ name: "twitter:image", content: opts.image });
  }

  if (opts.noIndex) {
    meta.push({ name: "robots", content: "noindex,nofollow" });
  }

  const links: Array<Record<string, string>> = [];
  if (opts.canonicalPath) {
    links.push({ rel: "canonical", href: opts.canonicalPath });
  }

  return { meta, links };
}
