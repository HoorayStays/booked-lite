import { appUrl } from "@/lib/env";
import { embedSnippet, type EmbedStyle } from "@/lib/embed";
import { isHexColor, readableInk } from "@/lib/brand";

/** A pretend website showing the embed snippet, used for the live preview in Admin → Share & embed. */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const base = appUrl();
  const style = (["inline", "floating", "button"].includes(sp.get("style") ?? "") ? sp.get("style") : "inline") as EmbedStyle;
  const path = sp.get("path") ?? "/";
  if (!path.startsWith("/") || path.startsWith("//")) return new Response("Bad path", { status: 400 });
  const color = isHexColor(sp.get("color") ?? "") ? sp.get("color")! : "#4f46e5";
  const snippet = embedSnippet({
    style,
    url: `${base}${path}`,
    scriptUrl: `${base}/embed.js`,
    text: (sp.get("text") || "Book a call").slice(0, 60),
    color,
    ink: readableInk(color),
  });
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Your website</title>
<style>body{margin:0;font-family:Georgia,serif;color:#1f2937;background:#fffdf8}header{padding:18px 24px;border-bottom:1px solid #eee;font-weight:700}
main{max-width:860px;margin:0 auto;padding:24px}p{line-height:1.6;color:#4b5563}.ph{height:10px;background:#eee;border-radius:6px;margin:10px 0}</style></head>
<body><header>🏡 Your website</header><main><h2>Plan your stay with us</h2>
<p>This is how the booking widget looks on your own website.</p><div class="ph" style="width:80%"></div><div class="ph" style="width:60%"></div>
<div style="margin:24px 0">${snippet}</div><div class="ph" style="width:70%"></div><div class="ph" style="width:50%"></div></main></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
