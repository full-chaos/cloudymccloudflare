interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon = "◈",
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-16 px-8 text-center ${className}`}
    >
      {/* Icon */}
      <div className="mb-4 text-4xl text-text-muted leading-none select-none">
        {icon}
      </div>

      {/* Title */}
      <h3 className="text-base font-semibold text-text-secondary font-display mb-2">
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p className="text-sm text-text-muted leading-relaxed max-w-xs mb-6">
          {description}
        </p>
      )}

      {/* Action */}
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 text-sm font-semibold text-white rounded-lg btn-primary transition-all"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
