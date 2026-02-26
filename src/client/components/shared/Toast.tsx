import type { Toast, ToastType } from "../../types";

interface ToastProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

function toastStyles(type: ToastType): { border: string; icon: string; iconColor: string } {
  switch (type) {
    case "success":
      return {
        border: "border-emerald-500/40",
        icon: "✓",
        iconColor: "text-emerald-400",
      };
    case "error":
      return {
        border: "border-red-500/40",
        icon: "✕",
        iconColor: "text-red-400",
      };
    case "warning":
      return {
        border: "border-yellow-500/40",
        icon: "⚠",
        iconColor: "text-yellow-400",
      };
    case "info":
    default:
      return {
        border: "border-accent/40",
        icon: "ℹ",
        iconColor: "text-accent",
      };
  }
}

function ToastItem({ toast, onRemove }: ToastProps) {
  const styles = toastStyles(toast.type);

  return (
    <div
      className={`
        flex items-start gap-3 px-4 py-3 rounded-[10px] min-w-[280px] max-w-sm
        bg-bg-secondary border ${styles.border}
        shadow-[0_8px_32px_rgba(0,0,0,0.4)]
        animate-slide-in
      `}
      role="alert"
    >
      <span className={`text-base font-bold mt-0.5 flex-shrink-0 ${styles.iconColor}`}>
        {styles.icon}
      </span>
      <p className="flex-1 text-sm text-text-primary font-display leading-relaxed">
        {toast.message}
      </p>
      <button
        onClick={() => onRemove(toast.id)}
        className="flex-shrink-0 text-text-muted hover:text-text-secondary transition-colors mt-0.5 leading-none"
        aria-label="Dismiss notification"
      >
        ✕
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 items-end"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}
