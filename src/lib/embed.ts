/** Builds the copy-paste snippets shown in Admin → Share & embed. Covered by tests/embed.test.ts. */

export type EmbedStyle = "inline" | "floating" | "button";
export type EmbedOptions = { style: EmbedStyle; url: string; scriptUrl: string; text: string; color: string; ink: string };

function attr(v: string) {
  return v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

export function embedSnippet(o: EmbedOptions): string {
  const script = `<script src="${attr(o.scriptUrl)}" async></script>`;
  switch (o.style) {
    case "inline":
      return `<div data-booked="inline" data-url="${attr(o.url)}"></div>\n${script}`;
    case "floating":
      return `<div data-booked="floating" data-url="${attr(o.url)}" data-text="${attr(o.text)}" data-color="${attr(o.color)}"></div>\n${script}`;
    case "button":
      return (
        `<a href="${attr(o.url)}" data-booked="popup" target="_blank" ` +
        `style="display:inline-block;padding:12px 22px;border-radius:10px;background:${attr(o.color)};color:${attr(o.ink)};` +
        `font:600 16px system-ui,sans-serif;text-decoration:none">${attr(o.text)}</a>\n${script}`
      );
  }
}

/** For places that don't allow scripts (emails, some site builders): a plain styled link. */
export function plainLink(o: Pick<EmbedOptions, "url" | "text" | "color" | "ink">): string {
  return (
    `<a href="${attr(o.url)}" target="_blank" ` +
    `style="display:inline-block;padding:12px 22px;border-radius:10px;background:${attr(o.color)};color:${attr(o.ink)};` +
    `font:600 16px system-ui,sans-serif;text-decoration:none">${attr(o.text)}</a>`
  );
}
