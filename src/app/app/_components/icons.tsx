import type { AppIconName } from "./data";

export function PixelIcon({
  name,
  className,
}: {
  name: AppIconName;
  className?: string;
}) {
  const common = {
    fill: "currentColor",
    shapeRendering: "crispEdges" as const,
  };

  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
    >
      {name === "farm" ? (
        <>
          <rect {...common} x="4" y="12" width="16" height="7" />
          <rect {...common} x="7" y="9" width="10" height="3" />
          <rect {...common} x="10" y="6" width="4" height="3" />
          <rect {...common} x="8" y="15" width="3" height="4" opacity="0.55" />
          <rect {...common} x="14" y="15" width="3" height="4" opacity="0.55" />
        </>
      ) : null}
      {name === "shop" ? (
        <>
          <rect {...common} x="5" y="7" width="14" height="4" />
          <rect {...common} x="6" y="11" width="12" height="9" />
          <rect {...common} x="8" y="14" width="3" height="3" opacity="0.55" />
          <rect {...common} x="13" y="14" width="3" height="6" opacity="0.55" />
          <rect {...common} x="8" y="4" width="8" height="3" />
        </>
      ) : null}
      {name === "inventory" ? (
        <>
          <rect {...common} x="5" y="5" width="14" height="4" />
          <rect {...common} x="6" y="9" width="12" height="10" />
          <rect {...common} x="8" y="12" width="3" height="2" opacity="0.55" />
          <rect {...common} x="13" y="12" width="3" height="2" opacity="0.55" />
          <rect {...common} x="8" y="16" width="8" height="2" opacity="0.55" />
        </>
      ) : null}
      {name === "intelligence" ? (
        <>
          <rect {...common} x="8" y="4" width="8" height="3" />
          <rect {...common} x="6" y="7" width="12" height="9" />
          <rect {...common} x="8" y="10" width="3" height="3" opacity="0.55" />
          <rect {...common} x="13" y="10" width="3" height="3" opacity="0.55" />
          <rect {...common} x="10" y="16" width="4" height="3" />
          <rect {...common} x="4" y="10" width="2" height="4" />
          <rect {...common} x="18" y="10" width="2" height="4" />
        </>
      ) : null}
      {name === "social" ? (
        <>
          <rect {...common} x="6" y="5" width="5" height="5" />
          <rect {...common} x="14" y="6" width="4" height="4" />
          <rect {...common} x="4" y="13" width="9" height="5" />
          <rect {...common} x="12" y="14" width="8" height="4" opacity="0.7" />
        </>
      ) : null}
    </svg>
  );
}
