"use client";

import { useState } from "react";

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="row" style={{ gap: 8 }}>
      <code style={{ wordBreak: "break-all", background: "var(--surface-2)", padding: "8px 10px", borderRadius: 8, flex: "1 1 220px" }}>{url}</code>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => {
          navigator.clipboard?.writeText(url).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
      >
        {copied ? "Copied ✓" : "Copy link"}
      </button>
    </div>
  );
}
