import { useMemo } from "react";
import { WorldMap } from "react-svg-worldmap";
import type { ISOCode } from "react-svg-worldmap";
import { formatCount } from "../../lib/format";

export interface GeoChoroplethProps {
  items: Array<{ key: string; requests: number }>;
  height?: number;
  emptyMessage?: string;
}

export function filterCountryItems(items: Array<{ key: string; requests: number }>) {
  const validItems: Array<{ country: ISOCode; value: number }> = [];
  let unknownRequests = 0;

  for (const item of items) {
    if (item.requests <= 0) continue;

    const key = (item.key || "").toLowerCase();
    if (!key || key === "xx") {
      unknownRequests += item.requests;
    } else {
      validItems.push({ country: key as ISOCode, value: item.requests });
    }
  }

  return { validItems, unknownRequests };
}

export function GeoChoropleth({
  items,
  height = 320,
  emptyMessage = "No country data in this window.",
}: GeoChoroplethProps) {
  const { validItems, unknownRequests } = useMemo(() => filterCountryItems(items), [items]);

  if (validItems.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-text-muted text-xs"
        style={{ height }}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col" style={{ height }}>
      <div className="flex-1 min-h-0">
        <WorldMap
          data={validItems}
          color="#60a5fa"
          size="responsive"
          valueSuffix=" requests"
          backgroundColor="transparent"
          tooltipTextFunction={(context) =>
            `${context.countryName}: ${formatCount(Number(context.countryValue) || 0)} requests`
          }
        />
      </div>
      {unknownRequests > 0 && (
        <div className="text-xs text-text-muted text-center mt-2">
          Unknown: {formatCount(unknownRequests)} requests
        </div>
      )}
    </div>
  );
}
