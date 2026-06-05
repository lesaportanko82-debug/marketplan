import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, ChevronDown, ChevronRight, Bug } from "lucide-react";
import { Mascot } from "./Mascot";

interface Props {
  children: ReactNode;
  /** Shown in the fallback header */
  moduleName?: string;
  /** Compact mode: smaller card for inline usage */
  compact?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, showDetails: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(
      `[ErrorBoundary${this.props.moduleName ? ` - ${this.props.moduleName}` : ""}]`,
      error,
      info.componentStack
    );
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, showDetails: false });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const { moduleName, compact } = this.props;
    const { error, showDetails } = this.state;

    if (compact) {
      return (
        <div className="bg-red-500/[0.06] border border-red-500/20 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] text-foreground font-medium">
              Ошибка{moduleName ? ` в «${moduleName}»` : ""}
            </p>
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
              {error?.message || "Неизвестная ошибка"}
            </p>
          </div>
          <button
            onClick={this.handleRetry}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-500 rounded-md text-[12px] font-medium hover:bg-red-500/20 transition-colors shrink-0"
          >
            <RefreshCw className="w-3 h-3" /> Повторить
          </button>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center p-8 min-h-[300px]">
        <div className="bg-card border border-border rounded-xl p-8 max-w-[520px] w-full text-center shadow-sm">
          {/* Mascot */}
          <div className="flex justify-center mb-4">
            <Mascot emotion="oops" size={110} animate={false} />
          </div>

          {/* Title */}
          <h2 className="text-[18px] font-semibold text-foreground mb-1.5">
            Что-то пошло не так
          </h2>
          <p className="text-[13px] text-muted-foreground mb-5">
            {moduleName
              ? `Модуль «${moduleName}» столкнулся с ошибкой.`
              : "Компонент столкнулся с ошибкой."}{" "}
            Ваши данные в безопасности.
          </p>

          {/* Actions */}
          <div className="flex items-center justify-center gap-3 mb-5">
            <button
              onClick={this.handleRetry}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-medium transition-colors"
              style={{
                background: "linear-gradient(135deg, #d4a373 0%, #c0854a 100%)",
                color: "#fff",
              }}
            >
              <RefreshCw className="w-4 h-4" /> Попробовать снова
            </button>
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 px-4 py-2.5 bg-muted text-muted-foreground rounded-lg text-[13px] hover:text-foreground transition-colors"
            >
              Перезагрузить страницу
            </button>
          </div>

          {/* Error details (collapsible) */}
          {error && (
            <div className="text-left">
              <button
                onClick={() => this.setState({ showDetails: !showDetails })}
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors mx-auto"
              >
                {showDetails ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
                Подробности ошибки
              </button>
              {showDetails && (
                <div className="mt-3 bg-muted/50 border border-border rounded-lg p-3 text-left">
                  <p className="text-[11px] font-mono text-red-500/80 break-all leading-relaxed">
                    {error.name}: {error.message}
                  </p>
                  {error.stack && (
                    <pre className="mt-2 text-[10px] font-mono text-muted-foreground overflow-x-auto max-h-[120px] overflow-y-auto leading-relaxed">
                      {error.stack.split("\n").slice(1, 6).join("\n")}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
}