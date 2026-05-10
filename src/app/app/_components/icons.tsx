import Image from "next/image";
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

const glyphSources: Record<PixelGlyphName, string> = {
  scroll: "/app-icons/scroll.png",
  ledger: "/app-icons/ledger.png",
  leaf: "/app-icons/leaf.png",
  warning: "/app-icons/warning.png",
  sparkle: "/app-icons/sparkle.png",
  jar: "/app-icons/jar.png",
  wheat: "/app-icons/wheat.png",
  sun: "/app-icons/sun.png",
  wagon: "/app-icons/wagon.png",
  basket: "/app-icons/basket.png",
  seed: "/app-icons/seed.png",
  trash: "/app-icons/trash.png",
};

const appIconSources: Record<AppIconName, string> = {
  farm: "/app-icons/farm.png",
  inventory: "/app-icons/inventory.png",
  shop: "/app-icons/shop.png",
  intelligence: "/app-icons/intelligence.png",
  social: "/app-icons/social.png",
};

export function SunpatchLogo({
  alt = "Sunpatch logo",
  className = "",
  priority = false,
}: {
  alt?: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/sunpatch-logo.png"
      alt={alt}
      width={698}
      height={768}
      priority={priority}
      className={`object-contain ${className}`}
      style={{ imageRendering: "pixelated" }}
      unoptimized
    />
  );
}

export function PixelGlyph({
  name,
  className,
}: {
  name: PixelGlyphName;
  className?: string;
}) {
  return <PixelImageIcon src={glyphSources[name]} className={className} />;
}

export function PixelIcon({
  name,
  className,
}: {
  name: AppIconName;
  className?: string;
}) {
  return <PixelImageIcon src={appIconSources[name]} className={className} />;
}

function PixelImageIcon({
  src,
  className,
}: {
  src: string;
  className?: string;
}) {
  return (
    <Image
      aria-hidden="true"
      src={src}
      alt=""
      width={16}
      height={16}
      className={`object-contain ${className ?? ""}`}
      style={{ imageRendering: "pixelated" }}
      unoptimized
    />
  );
}
