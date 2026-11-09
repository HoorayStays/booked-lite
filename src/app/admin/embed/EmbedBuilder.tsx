"use client";

import { useState } from "react";
import { embedSnippet, plainLink, type EmbedStyle } from "@/lib/embed";
import { readableInk } from "@/lib/brand";

type Page = { label: string; path: string };

function Copy({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-secondary btn-sm"
      onClick={() => navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}
    >
      {copied ? "Copied ✓" : label}
    </button>
  );
}

export function EmbedBuilder({ pages, baseUrl, brandColor }: { pages: Page[]; baseUrl: string; brandColor: string }) {
  const [path, setPath] = useState(pages[0]?.path ?? "/");
  const [style, setStyle] = useState<EmbedStyle>("inline");
  const [text, setText] = useState("Book a call");
  const [color, setColor] = useState(brandColor);
  const opts = { style, url: `${baseUrl}${path}`, scriptUrl: `${baseUrl}/embed.js`, text, color, ink: readableInk(color) };
  const snippet = embedSnippet(opts);
  const preview = `/api/embed-preview?${new URLSearchParams({ style, path, text, color })}`;

  return (
    <div className="stack">
      <div className="card stack">
        <div>
          <label htmlFor="page">Which page?</label>
          <select id="page" value={path} onChange={(e) => setPath(e.target.value)}>
            {pages.map((p) => <option key={p.path} value={p.path}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <span className="small"><strong>Style</strong></span>
          <div className="choice mt" style={{ marginTop: 6 }}>
            {([
              ["inline", "Inline", "The booking page sits right inside your web page."],
              ["floating", "Floating button", "A “Book a call” button in the corner opens a popup."],
              ["button", "Button / link", "A button anywhere on your page that opens a popup."],
            ] as const).map(([value, label, hint]) => (
              <label key={value}>
                <input type="radio" name="style" checked={style === value} onChange={() => setStyle(value)} />
                <span>{label}<span className="hint" style={{ display: "block" }}>{hint}</span></span>
              </label>
            ))}
          </div>
        </div>
        {style !== "inline" && (
          <div className="grid-2">
            <div>
              <label htmlFor="btn-text">Button text</label>
              <input id="btn-text" type="text" value={text} onChange={(e) => setText(e.target.value)} maxLength={40} />
            </div>
            <div>
              <label htmlFor="btn-color">Button color</label>
              <input id="btn-color" type="color" value={color} onChange={(e) => setColor(e.target.value)} />
            </div>
          </div>
        )}
        <div className="snippet stack-sm">
          <div className="row between">
            <strong className="small">Copy this and paste it into your website</strong>
            <Copy text={snippet} label="Copy code" />
          </div>
          <pre data-testid="embed-snippet">{snippet}</pre>
          <p className="subtle">
            Paste it into an “HTML”, “Code” or “Embed” block. Step-by-step help for WordPress, Wix, Squarespace and Google Sites is
            in SETUP.md → “Put it on your website”.
          </p>
        </div>
        {style === "button" && (
          <div className="snippet stack-sm">
            <div className="row between">
              <strong className="small">No scripts allowed? (emails, some site builders)</strong>
              <Copy text={plainLink(opts)} label="Copy plain link" />
            </div>
            <pre>{plainLink(opts)}</pre>
          </div>
        )}
      </div>
      <div className="card stack-sm">
        <strong>Live preview</strong>
        <iframe key={preview} src={preview} className="preview-frame" title="Embed preview" />
      </div>
    </div>
  );
}
