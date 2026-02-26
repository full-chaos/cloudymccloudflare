interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  message?: string;
  className?: string;
}

export function LoadingSpinner({
  size = "md",
  message,
  className = "",
}: LoadingSpinnerProps) {
  const sizeMap = {
    sm: { outer: 24, inner: 16, stroke: 3 },
    md: { outer: 40, inner: 28, stroke: 3 },
    lg: { outer: 56, inner: 40, stroke: 4 },
  };

  const { outer, inner, stroke } = sizeMap[size];

  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      {/* Pulse rings */}
      <div className="relative flex items-center justify-center">
        {/* Outer ring - pulse */}
        <div
          className="absolute rounded-full border border-accent/20 animate-ping"
          style={{ width: outer, height: outer }}
        />
        {/* Mid ring - slow spin */}
        <div
          className="absolute rounded-full border border-t-accent border-accent/10 animate-spin"
          style={{
            width: outer - 4,
            height: outer - 4,
            borderWidth: stroke,
            animationDuration: "1.2s",
          }}
        />
        {/* Inner dot */}
        <div
          className="rounded-full bg-accent/30"
          style={{ width: inner / 3, height: inner / 3 }}
        />
      </div>

      {message && (
        <p className="text-sm text-text-secondary font-display animate-pulse">
          {message}
        </p>
      )}
    </div>
  );
}

interface LoadingOverlayProps {
  message?: string;
}

export function LoadingOverlay({ message = "Loading..." }: LoadingOverlayProps) {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[200px]">
      <LoadingSpinner size="md" message={message} />
    </div>
  );
}
