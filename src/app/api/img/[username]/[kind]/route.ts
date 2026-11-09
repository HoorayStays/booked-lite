import { getUserByUsername } from "@/lib/users";

/** Serves the host's logo / cover image (stored in the database as a small data URL). */
export async function GET(_req: Request, { params }: { params: Promise<{ username: string; kind: string }> }) {
  const { username, kind } = await params;
  if (kind !== "logo" && kind !== "cover") return new Response("Not found", { status: 404 });
  const user = await getUserByUsername(username);
  const dataUrl = user?.[kind];
  const match = dataUrl?.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
  if (!match) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(match[2], "base64"), {
    headers: {
      "content-type": match[1],
      // URLs include ?v=<version>, so they can be cached for a long time.
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
