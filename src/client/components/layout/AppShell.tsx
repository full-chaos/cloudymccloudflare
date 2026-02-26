import type { ReactNode } from "react";
import type { ViewType } from "../../types";
import type { Group, Zone } from "../../types";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

interface AppShellProps {
  currentView: ViewType;
  onNavigate: (view: ViewType) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  groups: Group[];
  zones: Zone[];
  onGroupSelect?: (groupId: string) => void;
  selectedGroupId?: string;
  children: ReactNode;
}

export function AppShell({
  currentView,
  onNavigate,
  searchQuery,
  onSearchChange,
  groups,
  zones,
  onGroupSelect,
  selectedGroupId,
  children,
}: AppShellProps) {
  return (
    <div className="flex flex-col h-screen bg-bg-primary overflow-hidden">
      {/* Sticky header */}
      <Header searchQuery={searchQuery} onSearchChange={onSearchChange} />

      {/* Body: sidebar + main */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          currentView={currentView}
          onNavigate={onNavigate}
          groups={groups}
          zones={zones}
          onGroupSelect={onGroupSelect}
          selectedGroupId={selectedGroupId}
        />

        {/* Main content */}
        <main className="flex-1 overflow-y-auto bg-bg-primary">
          <div className="animate-fade-up">{children}</div>
        </main>
      </div>
    </div>
  );
}
