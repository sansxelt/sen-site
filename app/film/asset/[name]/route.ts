import { readFile } from "node:fs/promises";
import path from "node:path";

// The film renderer's source plates (screenshots of the demo apps and the console) live in .film-assets at
// the repo root, which git ignores. This serves them to the renderer in development. Production has neither
// the folder nor this route's answer.
const TYPES: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  if (process.env.NODE_ENV !== "development") return new Response("Not found", { status: 404 });
  const { name } = await params;
  const ext = path.extname(name).toLowerCase();
  if (!/^[a-z0-9-]+\.(png|jpe?g|webp)$/i.test(name) || !TYPES[ext]) return new Response("Not found", { status: 404 });
  try {
    const body = await readFile(path.join(process.cwd(), ".film-assets", name));
    return new Response(new Uint8Array(body), { headers: { "content-type": TYPES[ext], "cache-control": "no-store" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
