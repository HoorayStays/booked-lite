"use client";

import { useActionState, useState } from "react";
import { saveProfile, type ActionState } from "../actions";

/** Shrinks an image in the browser so it fits comfortably in the database. */
async function resize(file: File, maxW: number, maxH: number): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const scale = Math.min(1, maxW / img.width, maxH / img.height);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const png = file.type === "image/png" && maxW <= 400;
    return canvas.toDataURL(png ? "image/png" : "image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function ImageField(props: { name: "logo" | "cover"; label: string; hint: string; current: string | null; maxW: number; maxH: number }) {
  const [value, setValue] = useState<string>("keep");
  const preview = value === "keep" ? props.current : value || null;
  return (
    <div className="stack-sm">
      <label htmlFor={`f-${props.name}`}>{props.label}</label>
      <input type="hidden" name={props.name} value={value} />
      <div className="preview-swatch" style={{ backgroundImage: preview ? `url(${preview})` : undefined, ...(props.name === "logo" ? { width: 72, height: 72, backgroundSize: "cover" } : {}) }} />
      <input
        id={`f-${props.name}`}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) setValue(await resize(f, props.maxW, props.maxH));
        }}
      />
      <p className="hint">{props.hint}</p>
      {preview && (
        <div><button type="button" className="btn btn-ghost btn-sm" style={{ paddingLeft: 0 }} onClick={() => setValue("")}>Remove image</button></div>
      )}
    </div>
  );
}

type Props = { name: string; username: string; bio: string; brandColor: string; logo: string | null; cover: string | null; baseUrl: string };

export function ProfileForm(p: Props) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveProfile, {});
  const [color, setColor] = useState(p.brandColor);
  const [username, setUsername] = useState(p.username);
  return (
    <form action={action} className="card stack">
      <strong>Profile &amp; branding</strong>
      <div className="grid-2">
        <div>
          <label htmlFor="name">Name shown to guests</label>
          <input id="name" name="name" type="text" defaultValue={p.name} maxLength={80} placeholder="Alex at Example Stays" />
        </div>
        <div>
          <label htmlFor="username">Your link name</label>
          <input id="username" name="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} maxLength={40} required />
          <p className="hint" style={{ wordBreak: "break-all" }}>{p.baseUrl}/{username}</p>
        </div>
      </div>
      <div>
        <label htmlFor="bio">Short intro</label>
        <textarea id="bio" name="bio" defaultValue={p.bio} maxLength={1000} placeholder="Short-term rental host. Book a time to chat about your property." />
      </div>
      <div>
        <label htmlFor="brandColor">Brand color</label>
        <div className="row" style={{ gap: 8 }}>
          <input id="brandColor" name="brandColor" type="color" value={color} onChange={(e) => setColor(e.target.value)} />
          <code>{color}</code>
          <span className="btn btn-sm" style={{ ["--brand" as string]: color, pointerEvents: "none" }}>Button preview</span>
        </div>
      </div>
      <div className="grid-2">
        <ImageField name="logo" label="Logo or photo" hint="Square works best. We shrink it for you." current={p.logo} maxW={256} maxH={256} />
        <ImageField name="cover" label="Cover image" hint="A wide photo of your property looks great." current={p.cover} maxW={1600} maxH={600} />
      </div>
      <div className="row">
        <button className="btn" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
        {state.message && <span className="muted" role="status">{state.message}</span>}
        {state.error && <span className="alert alert-error" role="alert">{state.error}</span>}
      </div>
    </form>
  );
}
