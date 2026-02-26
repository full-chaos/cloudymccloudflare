interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function Header({ searchQuery, onSearchChange }: HeaderProps) {
  return (
    <header
      className="h-14 flex items-center px-5 gap-4 border-b border-border bg-bg-primary sticky top-0 z-30"
      style={{ backdropFilter: "blur(8px)" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 flex-shrink-0">
        {/* Cloud icon */}
        <div className="relative flex items-center justify-center w-8 h-8">
          <svg
            width="28"
            height="28"
            viewBox="0 0 28 28"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M22 18H8.5C5.46 18 3 15.54 3 12.5C3 9.74 5.01 7.47 7.66 7.05C8.21 4.72 10.31 3 12.8 3C15.09 3 17.05 4.44 17.83 6.47C18.11 6.42 18.39 6.4 18.68 6.4C21.06 6.4 23 8.34 23 10.72C23 11.15 22.94 11.57 22.83 11.96C23.52 12.39 24 13.15 24 14C24 15.1 23.1 16 22 16V18Z"
              fill="url(#cloudGradient)"
            />
            <defs>
              <linearGradient id="cloudGradient" x1="3" y1="3" x2="24" y2="18" gradientUnits="userSpaceOnUse">
                <stop stopColor="#f97316" />
                <stop offset="1" stopColor="#ea580c" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Brand name */}
        <div className="flex items-baseline gap-1">
          <span
            className="text-sm font-bold font-display"
            style={{
              background: "linear-gradient(135deg, #f97316, #fbbf24)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            CloudlyMcCloudFlare
          </span>
          {/* Version badge */}
          <span className="text-[10px] font-mono text-text-muted border border-border rounded px-1 py-0.5 leading-none">
            v1.0
          </span>
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Search */}
      <div className="relative w-56">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
            <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.099zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z" />
          </svg>
        </div>
        <input
          type="search"
          placeholder="Search domains..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 text-xs bg-bg-secondary border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 transition-colors font-display"
        />
      </div>

      {/* Status indicator */}
      <div className="flex items-center gap-1.5 text-xs text-text-muted">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span className="font-display">Live</span>
      </div>
    </header>
  );
}
