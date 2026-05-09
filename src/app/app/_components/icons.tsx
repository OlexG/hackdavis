import type { AppIconName } from "./data";

export type PixelGlyphName =
  | "scroll"
  | "ledger"
  | "leaf"
  | "warning"
  | "sparkle"
  | "jar"
  | "wheat"
  | "sun"
  | "wagon"
  | "basket"
  | "seed"
  | "trash";

export function PixelGlyph({
  name,
  className,
}: {
  name: PixelGlyphName;
  className?: string;
}) {
  const c = { fill: "currentColor", shapeRendering: "crispEdges" as const };
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 16 16" fill="none">
      {name === "scroll" ? (
        <>
          <rect {...c} x="3" y="2" width="10" height="1" />
          <rect {...c} x="2" y="3" width="12" height="1" />
          <rect {...c} x="3" y="4" width="10" height="9" />
          <rect {...c} x="2" y="13" width="12" height="1" />
          <rect {...c} x="3" y="14" width="10" height="1" />
          <rect {...c} x="5" y="6" width="6" height="1" opacity="0.5" />
          <rect {...c} x="5" y="8" width="6" height="1" opacity="0.5" />
          <rect {...c} x="5" y="10" width="4" height="1" opacity="0.5" />
        </>
      ) : null}
      {name === "ledger" ? (
        <>
          <rect {...c} x="3" y="2" width="10" height="12" />
          <rect {...c} x="3" y="2" width="1" height="12" opacity="0.6" />
          <rect {...c} x="5" y="4" width="6" height="1" opacity="0.45" />
          <rect {...c} x="5" y="6" width="6" height="1" opacity="0.45" />
          <rect {...c} x="5" y="8" width="6" height="1" opacity="0.45" />
          <rect {...c} x="5" y="10" width="4" height="1" opacity="0.45" />
        </>
      ) : null}
      {name === "leaf" ? (
        <>
          <rect {...c} x="9" y="3" width="3" height="1" />
          <rect {...c} x="7" y="4" width="5" height="1" />
          <rect {...c} x="6" y="5" width="6" height="1" />
          <rect {...c} x="5" y="6" width="6" height="1" />
          <rect {...c} x="4" y="7" width="6" height="1" />
          <rect {...c} x="4" y="8" width="5" height="1" />
          <rect {...c} x="4" y="9" width="3" height="1" />
          <rect {...c} x="3" y="10" width="2" height="3" />
          <rect {...c} x="8" y="6" width="1" height="3" opacity="0.55" />
        </>
      ) : null}
      {name === "warning" ? (
        <>
          <rect {...c} x="7" y="2" width="2" height="1" />
          <rect {...c} x="6" y="3" width="4" height="1" />
          <rect {...c} x="5" y="4" width="6" height="2" />
          <rect {...c} x="4" y="6" width="8" height="2" />
          <rect {...c} x="3" y="8" width="10" height="2" />
          <rect {...c} x="2" y="10" width="12" height="2" />
          <rect fill="#fffdf5" shapeRendering="crispEdges" x="7" y="5" width="2" height="3" />
          <rect fill="#fffdf5" shapeRendering="crispEdges" x="7" y="9" width="2" height="1" />
        </>
      ) : null}
      {name === "sparkle" ? (
        <>
          <rect {...c} x="7" y="2" width="2" height="2" />
          <rect {...c} x="7" y="12" width="2" height="2" />
          <rect {...c} x="2" y="7" width="2" height="2" />
          <rect {...c} x="12" y="7" width="2" height="2" />
          <rect {...c} x="6" y="6" width="4" height="4" />
          <rect {...c} x="5" y="7" width="6" height="2" />
          <rect {...c} x="7" y="5" width="2" height="6" />
        </>
      ) : null}
      {name === "jar" ? (
        <>
          <rect {...c} x="5" y="2" width="6" height="1" />
          <rect {...c} x="4" y="3" width="8" height="2" />
          <rect {...c} x="3" y="5" width="10" height="9" />
          <rect {...c} x="3" y="14" width="10" height="1" />
          <rect fill="#fffdf5" shapeRendering="crispEdges" x="5" y="8" width="6" height="3" opacity="0.4" />
        </>
      ) : null}
      {name === "wheat" ? (
        <>
          <rect {...c} x="7" y="2" width="2" height="11" />
          <rect {...c} x="5" y="4" width="2" height="2" opacity="0.7" />
          <rect {...c} x="9" y="4" width="2" height="2" opacity="0.7" />
          <rect {...c} x="4" y="6" width="2" height="2" opacity="0.7" />
          <rect {...c} x="10" y="6" width="2" height="2" opacity="0.7" />
          <rect {...c} x="3" y="8" width="2" height="2" opacity="0.7" />
          <rect {...c} x="11" y="8" width="2" height="2" opacity="0.7" />
          <rect {...c} x="6" y="13" width="4" height="1" />
        </>
      ) : null}
      {name === "sun" ? (
        <>
          <rect {...c} x="6" y="6" width="4" height="4" />
          <rect {...c} x="5" y="5" width="6" height="6" />
          <rect {...c} x="7" y="2" width="2" height="2" />
          <rect {...c} x="7" y="12" width="2" height="2" />
          <rect {...c} x="2" y="7" width="2" height="2" />
          <rect {...c} x="12" y="7" width="2" height="2" />
          <rect {...c} x="3" y="3" width="2" height="2" opacity="0.7" />
          <rect {...c} x="11" y="3" width="2" height="2" opacity="0.7" />
          <rect {...c} x="3" y="11" width="2" height="2" opacity="0.7" />
          <rect {...c} x="11" y="11" width="2" height="2" opacity="0.7" />
        </>
      ) : null}
      {name === "wagon" ? (
        <>
          <rect {...c} x="2" y="5" width="11" height="5" />
          <rect {...c} x="13" y="7" width="2" height="2" />
          <rect {...c} x="3" y="11" width="3" height="3" />
          <rect {...c} x="10" y="11" width="3" height="3" />
          <rect fill="#fffdf5" shapeRendering="crispEdges" x="4" y="12" width="1" height="1" />
          <rect fill="#fffdf5" shapeRendering="crispEdges" x="11" y="12" width="1" height="1" />
        </>
      ) : null}
      {name === "basket" ? (
        <>
          <rect {...c} x="4" y="3" width="8" height="1" />
          <rect {...c} x="3" y="4" width="10" height="1" />
          <rect {...c} x="2" y="6" width="12" height="7" />
          <rect fill="#fffdf5" shapeRendering="crispEdges" x="4" y="8" width="2" height="3" opacity="0.5" />
          <rect fill="#fffdf5" shapeRendering="crispEdges" x="7" y="8" width="2" height="3" opacity="0.5" />
          <rect fill="#fffdf5" shapeRendering="crispEdges" x="10" y="8" width="2" height="3" opacity="0.5" />
        </>
      ) : null}
      {name === "seed" ? (
        <>
          <rect {...c} x="6" y="4" width="4" height="6" />
          <rect {...c} x="5" y="5" width="6" height="4" />
          <rect {...c} x="7" y="10" width="2" height="3" />
          <rect fill="#fffdf5" shapeRendering="crispEdges" x="7" y="6" width="1" height="2" opacity="0.7" />
        </>
      ) : null}
      {name === "trash" ? (
        <>
          <rect {...c} x="5" y="3" width="6" height="1" />
          <rect {...c} x="4" y="4" width="8" height="1" />
          <rect {...c} x="5" y="6" width="6" height="8" />
          <rect fill="#fffdf5" shapeRendering="crispEdges" x="7" y="7" width="1" height="5" opacity="0.55" />
          <rect fill="#fffdf5" shapeRendering="crispEdges" x="9" y="7" width="1" height="5" opacity="0.55" />
        </>
      ) : null}
    </svg>
  );
}

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
