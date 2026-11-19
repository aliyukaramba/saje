// Menu photo storage in Cloudflare R2. Images are checked for type and size before they are stored.
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

interface MediaBucket {
  put(key: string, value: ArrayBuffer, options: { httpMetadata: { contentType: string } }): Promise<unknown>;
}

/** Stores a product photo and returns its public URL. Throws a user-facing Error when the file is not allowed. */
export async function storeMenuImage(productId: string, file: File): Promise<string> {
  const ext = EXTENSIONS[file.type];
  if (!ext) throw new Error("Use a JPG, PNG or WebP image");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("The image must be 2 MB or smaller");

  const { env } = await getCloudflareContext({ async: true });
  const bucket = (env as unknown as { MEDIA: MediaBucket }).MEDIA;
  const key = `menu/${productId}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  await bucket.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });

  const base = (process.env.R2_PUBLIC_BASE_URL ?? "").replace(/\/$/, "");
  return `${base}/${key}`;
}
