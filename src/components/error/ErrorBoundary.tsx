import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reportLovableError } from "@/lib/lovable-error-reporting";

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  area?: string;
}

interface State {
  error: Error | null;
}

/**
 * ErrorBoundary global (Sprint 18.20).
 * Captura erros de renderização e mostra tela amigável dark premium.
 * Não expõe stack para usuário comum em produção.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", this.props.area ?? "global", error, info);
    reportLovableError(error, { boundary: "react_error_boundary", area: this.props.area });
  }

  reset = () => this.setState({ error: null });

  copyError = () => {
    if (!this.state.error) return;
    try {
      void navigator.clipboard.writeText(
        `${this.state.error.name}: ${this.state.error.message}\n${this.state.error.stack ?? ""}`,
      );
    } catch {
      // silencioso — clipboard pode não estar disponível
    }
  };

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(this.state.error, this.reset);

    const isDev = import.meta.env.DEV;

    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-background px-4 py-10">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-card">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/15 text-destructive">
            <AlertTriangle className="h-6 w-6" aria-hidden />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Algo deu errado</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Tivemos um problema ao carregar esta parte da LIT Buy. Tente novamente ou
            volte para a página inicial.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button onClick={this.reset}>Tentar novamente</Button>
            <Button variant="outline" onClick={() => (window.location.href = "/")}>
              Voltar para a home
            </Button>
            {isDev && (
              <Button variant="ghost" size="sm" onClick={this.copyError}>
                Copiar erro (dev)
              </Button>
            )}
          </div>
          {isDev && (
            <pre className="mt-4 max-h-40 overflow-auto rounded-lg bg-background/60 p-2 text-left text-[10px] text-muted-foreground">
              {this.state.error.message}
            </pre>
          )}
        </div>
      </div>
    );
  }
}
