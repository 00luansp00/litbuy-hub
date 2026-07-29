import { Button } from "@/components/ui/button";
export function CategoryCatalogPagination({
  page,
  hasNext,
  onPage,
}: {
  page: number;
  hasNext: boolean;
  onPage: (page: number) => void;
}) {
  return (
    <nav className="flex items-center justify-center gap-4" aria-label="Paginação do catálogo">
      <Button variant="outline" disabled={page === 1} onClick={() => onPage(page - 1)}>
        Anterior
      </Button>
      <span className="text-sm">Página {page}</span>
      <Button variant="outline" disabled={!hasNext} onClick={() => onPage(page + 1)}>
        Próxima
      </Button>
    </nav>
  );
}
