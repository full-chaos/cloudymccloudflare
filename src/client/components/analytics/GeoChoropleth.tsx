import { useEffect, useMemo, useRef, useState } from "react";
import { WorldMap } from "react-svg-worldmap";
import type { ISOCode } from "react-svg-worldmap";
import { formatCount } from "../../lib/format";

export interface GeoChoroplethProps {
  items: Array<{ key: string; requests: number }>;
  /** Used only for the empty-state height. The rendered map sizes itself to its container width and natural ~3:4 aspect ratio. */
  emptyHeight?: number;
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
  emptyHeight = 320,
  emptyMessage = "No country data in this window.",
}: GeoChoroplethProps) {
  const { validItems, unknownRequests } = useMemo(() => filterCountryItems(items), [items]);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [measuredWidth, setMeasuredWidth] = useState<number>(0);

  // react-svg-worldmap's size="responsive" measures the viewport, not its
  // parent, so it overflows narrow card containers. Measure the wrapper
  // ourselves and pass the resulting pixel width as size={N}. The library
  // then renders an SVG at that width and its natural ~3:4 aspect ratio —
  // we don't pin the height so the card grows with the map.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const update = () => setMeasuredWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (validItems.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-text-muted text-xs"
        style={{ height: emptyHeight }}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      ref={wrapperRef}
      className="w-full flex flex-col items-center overflow-hidden"
    >
      {measuredWidth > 0 && (
        <WorldMap
          data={validItems}
          color="#60a5fa"
          size={measuredWidth}
          valueSuffix=" requests"
          backgroundColor="transparent"
          tooltipTextFunction={(context) =>
            `${context.countryName}: ${formatCount(Number(context.countryValue) || 0)} requests`
          }
        />
      )}
      {unknownRequests > 0 && (
        <div className="text-xs text-text-muted text-center mt-2">
          Unknown: {formatCount(unknownRequests)} requests
        </div>
      )}
    </div>
  );
}
