import type { User } from "@/lib/db/schema";
import { brandStyle } from "@/lib/brand";
import { imageUrl } from "@/lib/public";
import { Footer } from "@/components/Footer";
import { EmbedBridge } from "./EmbedBridge";

/**
 * Frame for every public page. `embed` = shown inside a website via embed.js:
 * no cover photo, transparent background, a one-line credit, and auto-height.
 */
export function PublicShell({
  brand,
  embed,
  children,
  wide = false,
  event,
}: {
  brand: User;
  embed: boolean;
  children: React.ReactNode;
  wide?: boolean;
  event?: "scheduled";
}) {
  if (embed) {
    return (
      <div style={brandStyle(brand.brandColor)} className="embed-root">
        <main className="container" style={{ maxWidth: wide ? 1000 : 600, padding: "8px 8px 0" }}>{children}</main>
        <p className="embed-credit">
          Scheduling by B👀KED Lite · Built by <a href="https://cohoststudio.com" target="_blank" rel="noopener">CoHost Studio</a>
        </p>
        <EmbedBridge event={event} />
      </div>
    );
  }
  return (
    <div style={brandStyle(brand.brandColor)}>
      <main>
        <div
          className={brand.cover ? "cover" : "cover-none"}
          style={brand.cover ? { backgroundImage: `url(${imageUrl(brand, "cover")})` } : undefined}
        />
        <div className="container" style={{ maxWidth: wide ? 1000 : 600, marginTop: -40 }}>{children}</div>
      </main>
      <Footer />
    </div>
  );
}
