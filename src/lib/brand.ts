import type { CSSProperties } from "react";

export function isHexColor(v: string) {
  return /^#[0-9a-fA-F]{6}$/.test(v);
}

/** Black or white, whichever is easier to read on top of `hex`. */
export function readableInk(hex: string): string {
  if (!isHexColor(hex)) return "#ffffff";
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.45 ? "#111827" : "#ffffff";
}

/** CSS variables that re-theme a page with the host's brand color. */
export function brandStyle(hex: string): CSSProperties {
  const color = isHexColor(hex) ? hex : "#4f46e5";
  return {
    ["--brand" as string]: color,
    ["--brand-ink" as string]: readableInk(color),
    // Re-declared here so the soft tint follows the host's color, not the default.
    ["--brand-soft" as string]: `color-mix(in srgb, ${color} 11%, white)`,
  } as CSSProperties;
}
