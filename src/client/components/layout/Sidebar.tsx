import type { ViewType } from "../../types";
import type { Group, Zone } from "../../types";

interface NavItem {
  id: ViewType;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8.186 1.113a.5.5 0 0 0-.372 0L1.846 3.5l2.404.961L10.404 2l-2.218-.887zm3.564 1.426L5.596 5 8 5.961 14.154 3.5l-2.404-.961zm3.25 1.7-6.5 2.6v7.922l6.5-2.6V4.24zM7.5 14.762V6.838L1 4.239v7.923l6.5 2.6zM7.443.184a1.5 1.5 0 0 1 1.114 0l7.129 2.852A.5.5 0 0 1 16 3.5v8.662a1 1 0 0 1-.629.928l-7.185 2.874a.5.5 0 0 1-.372 0L.63 13.09a1 1 0 0 1-.63-.928V3.5a.5.5 0 0 1 .314-.464L7.443.184z" />
      </svg>
    ),
  },
  {
    id: "groups",
    label: "Groups",
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
        <path d="M1 14s-1 0-1-1 1-4 6-4 6 3 6 4-1 1-1 1H1zm5-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
        <path fillRule="evenodd" d="M13.5 5a.5.5 0 0 1 .5.5V7h1.5a.5.5 0 0 1 0 1H14v1.5a.5.5 0 0 1-1 0V8h-1.5a.5.5 0 0 1 0-1H13V5.5a.5.5 0 0 1 .5-.5z" />
      </svg>
    ),
  },
  {
    id: "dns",
    label: "DNS Records",
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
        <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm7.5-6.923c-.67.204-1.335.82-1.887 1.855-.143.268-.276.56-.395.872.705.157 1.472.257 2.282.287V1.077zM4.249 3.539c.142-.384.304-.744.481-1.078a6.7 6.7 0 0 1 .597-.933A7.01 7.01 0 0 0 3.051 3.05c.362.184.763.349 1.198.49zM3.509 7.5c.036-1.07.188-2.087.436-3.008a9.124 9.124 0 0 1-1.565-.667A6.964 6.964 0 0 0 1.018 7.5h2.49zm1.4-2.741a12.344 12.344 0 0 0-.4 2.741H7.5V5.091c-.91-.03-1.783-.145-2.591-.332zM8.5 5.09V7.5h2.99a12.342 12.342 0 0 0-.399-2.741c-.808.187-1.681.301-2.591.332zM4.51 8.5c.035.987.176 1.914.399 2.741A13.612 13.612 0 0 1 7.5 10.91V8.5H4.51zm3.99 0v2.409c.91.03 1.783.145 2.591.332.223-.827.364-1.754.4-2.741H8.5zm-3.282 3.696c.12.312.252.604.395.872.552 1.035 1.218 1.65 1.887 1.855V11.91c-.81.03-1.577.13-2.282.287zm.11 2.276a6.696 6.696 0 0 1-.598-.933 8.853 8.853 0 0 1-.481-1.079 8.38 8.38 0 0 0-1.198.49 7.01 7.01 0 0 0 2.276 1.522zm-1.383-2.964A13.36 13.36 0 0 1 3.508 8.5h-2.49a6.963 6.963 0 0 0 1.362 3.675c.47-.258.995-.482 1.565-.667zm6.728 2.964a7.009 7.009 0 0 0 2.275-1.521 8.376 8.376 0 0 0-1.197-.49 8.853 8.853 0 0 1-.481 1.078 6.688 6.688 0 0 1-.597.933zM8.5 11.909v3.014c.67-.204 1.335-.82 1.887-1.855.143-.268.276-.56.395-.872A12.63 12.63 0 0 0 8.5 11.91zm3.555-.401c.57.185 1.095.409 1.565.667A6.963 6.963 0 0 0 14.982 8.5h-2.49a13.36 13.36 0 0 1-.437 3.008zM14.982 7.5a6.963 6.963 0 0 0-1.362-3.675c-.47.258-.995.482-1.565.667.248.92.4 1.938.437 3.008h2.49zM11.27 2.461c.177.334.339.694.482 1.078a8.368 8.368 0 0 0 1.196-.49 7.01 7.01 0 0 0-2.275-1.52c.218.283.418.597.597.932zm-.488 1.343a7.765 7.765 0 0 0-.395-.872C9.835 1.897 9.17 1.282 8.5 1.077V4.09c.81-.03 1.577-.13 2.282-.287z" />
      </svg>
    ),
  },
  {
    id: "security",
    label: "Security Rules",
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
        <path d="M5.338 1.59a61.44 61.44 0 0 0-2.837.856.481.481 0 0 0-.328.39c-.554 4.157.726 7.19 2.253 9.188a10.725 10.725 0 0 0 2.287 2.233c.346.244.652.42.893.533.12.057.218.095.293.118a.55.55 0 0 0 .101.025.615.615 0 0 0 .1-.025c.076-.023.174-.061.294-.118.24-.113.547-.29.893-.533a10.726 10.726 0 0 0 2.287-2.233c1.527-1.997 2.807-5.031 2.253-9.188a.48.48 0 0 0-.328-.39c-.651-.213-1.75-.56-2.837-.855C9.552 1.29 8.531 1.067 8 1.067c-.53 0-1.552.223-2.662.524zM5.072.56C6.157.265 7.31 0 8 0s1.843.265 2.928.56c1.11.3 2.229.655 2.887.87a1.54 1.54 0 0 1 1.044 1.262c.596 4.477-.787 7.795-2.465 9.99a11.775 11.775 0 0 1-2.517 2.453 7.159 7.159 0 0 1-1.048.625c-.28.132-.581.24-.829.24s-.548-.108-.829-.24a7.158 7.158 0 0 1-1.048-.625 11.777 11.777 0 0 1-2.517-2.453C1.928 10.487.545 7.169 1.141 2.692A1.54 1.54 0 0 1 2.185 1.43 62.456 62.456 0 0 1 5.072.56z" />
      </svg>
    ),
  },
  {
    id: "templates",
    label: "Rule Templates",
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
        <path d="M14 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h12zM2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2z" />
        <path d="M6.854 4.646a.5.5 0 0 1 0 .708L4.207 8l2.647 2.646a.5.5 0 0 1-.708.708l-3-3a.5.5 0 0 1 0-.708l3-3a.5.5 0 0 1 .708 0zm2.292 0a.5.5 0 0 0 0 .708L11.793 8l-2.647 2.646a.5.5 0 0 0 .708.708l3-3a.5.5 0 0 0 0-.708l-3-3a.5.5 0 0 0-.708 0z" />
      </svg>
    ),
  },
];

interface SidebarProps {
  currentView: ViewType;
  onNavigate: (view: ViewType) => void;
  groups: Group[];
  zones: Zone[];
  onGroupSelect?: (groupId: string) => void;
  selectedGroupId?: string;
}

export function Sidebar({
  currentView,
  onNavigate,
  groups,
  zones,
  onGroupSelect,
  selectedGroupId,
}: SidebarProps) {
  return (
    <aside
      className="w-56 flex-shrink-0 bg-bg-primary border-r border-border flex flex-col overflow-hidden"
      style={{ height: "calc(100vh - 56px)" }}
    >
      {/* Navigation */}
      <nav className="pt-3 pb-2">
        {NAV_ITEMS.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`
                w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium font-display
                transition-all duration-150 text-left relative
                ${
                  isActive
                    ? "text-accent bg-accent/5 border-r-2 border-accent"
                    : "text-text-secondary hover:text-text-primary hover:bg-bg-secondary"
                }
              `}
            >
              <span className={isActive ? "text-accent" : "text-text-muted"}>
                {item.icon}
              </span>
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Divider */}
      <div className="mx-4 border-t border-border" />

      {/* Groups section */}
      <div className="flex-1 overflow-y-auto pt-3 pb-4">
        <div className="px-4 mb-2 flex items-center justify-between">
          <span className="text-[10px] font-semibold font-display text-text-muted uppercase tracking-wider">
            Groups
          </span>
          <span className="text-[10px] font-mono text-text-muted">
            {groups.length}
          </span>
        </div>

        {groups.length === 0 ? (
          <p className="px-4 text-xs text-text-muted font-display">
            No groups yet
          </p>
        ) : (
          <div className="space-y-0.5">
            {groups.map((group) => {
              const zoneCount = group.zoneIds.length;
              const isSelected = selectedGroupId === group.id;
              return (
                <button
                  key={group.id}
                  onClick={() => {
                    onGroupSelect?.(group.id);
                    onNavigate("dns");
                  }}
                  className={`
                    w-full flex items-center gap-2.5 px-4 py-2 text-left
                    transition-colors
                    ${
                      isSelected
                        ? "bg-accent/5 text-text-primary"
                        : "hover:bg-bg-secondary text-text-secondary hover:text-text-primary"
                    }
                  `}
                >
                  {/* Color dot */}
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: group.color }}
                  />
                  <span className="flex-1 text-xs font-display truncate">
                    {group.name}
                  </span>
                  <span className="text-[10px] font-mono text-text-muted">
                    {zoneCount}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Zones section */}
        <div className="px-4 mt-4 mb-2 flex items-center justify-between">
          <span className="text-[10px] font-semibold font-display text-text-muted uppercase tracking-wider">
            All Zones
          </span>
          <span className="text-[10px] font-mono text-text-muted">
            {zones.length}
          </span>
        </div>

        <div className="space-y-0.5">
          {zones.slice(0, 10).map((zone) => (
            <button
              key={zone.id}
              onClick={() => onNavigate("dns")}
              className="w-full flex items-center gap-2 px-4 py-1.5 text-left hover:bg-bg-secondary transition-colors group"
            >
              <span className="w-1 h-1 rounded-full bg-text-muted group-hover:bg-accent/60 transition-colors flex-shrink-0" />
              <span className="text-xs font-mono text-text-muted group-hover:text-text-secondary truncate transition-colors">
                {zone.name}
              </span>
            </button>
          ))}
          {zones.length > 10 && (
            <div className="px-4 py-1">
              <span className="text-[10px] text-text-muted font-display">
                +{zones.length - 10} more
              </span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
