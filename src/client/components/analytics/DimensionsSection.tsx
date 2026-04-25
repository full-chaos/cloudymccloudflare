import { useMemo } from "react";
import type { AnalyticsRange, AnalyticsScope } from "../../types";
import { useDimensions } from "../../hooks/useDimensions";
import { DimensionTabs, type Dim } from "./DimensionTabs";
import { GeoChoropleth } from "./GeoChoropleth";
import { StatusCodeDonut } from "./StatusCodeDonut";
import { ConnectionProfileDonuts } from "./ConnectionProfileDonuts";
import { WAFRuleBreakdown } from "./WAFRuleBreakdown";

export interface DimensionsSectionProps {
  scope: AnalyticsScope;
  range: AnalyticsRange;
  dim: Dim;
  onDimChange: (next: Dim) => void;
  title?: string;
}

export function DimensionsSection({
  scope,
  range,
  dim,
  onDimChange,
  title = "Dimensions",
}: DimensionsSectionProps) {
  const { data, loading, error } = useDimensions(scope, dim, range);

  const body = useMemo(() => {
    if (loading) {
      return (
        <div className="flex items-center justify-center text-text-muted text-xs h-64">
          Loading…
        </div>
      );
    }
    if (error) {
      return (
        <div className="flex items-center justify-center text-red-400 text-xs h-64">
          {error}
        </div>
      );
    }
    if (!data) {
      return (
        <div className="flex items-center justify-center text-text-muted text-xs h-64">
          No data
        </div>
      );
    }
    if (data.kind === "country") {
      return <GeoChoropleth items={data.items} />;
    }
    if (data.kind === "status") {
      return <StatusCodeDonut items={data.items} />;
    }
    if (data.kind === "protocol") {
      return (
        <ConnectionProfileDonuts
          httpVersions={data.httpVersions}
          sslVersions={data.sslVersions}
        />
      );
    }
    return <WAFRuleBreakdown rules={data.rules} />;
  }, [loading, error, data]);

  return (
    <section className="bg-bg-secondary border border-border rounded-[10px] p-4">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-sm font-semibold font-display text-text-primary">{title}</h2>
        <DimensionTabs active={dim} onChange={onDimChange} ariaLabel="Dimension" />
      </div>
      {body}
    </section>
  );
}
