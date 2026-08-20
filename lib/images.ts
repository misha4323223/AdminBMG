/**
 * Image helpers shared by admin list screens.
 * The API has legacy records with image/imageUrl/images and newer records with
 * thumbnailUrl/imageThumbnails. Lists should always prefer the smallest usable URL.
 */

function asUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const url = value.trim();
  return url || undefined;
}

function firstUrl(value: unknown): string | undefined {
  const direct = asUrl(value);
  if (direct) return direct;
  if (Array.isArray(value)) {
    for (const item of value) {
      const url = firstUrl(item);
      if (url) return url;
    }
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["url", "src", "uri", "href"]) {
      const url = asUrl(record[key]);
      if (url) return url;
    }
  }
  return undefined;
}

/** Convert a regular WebP object-storage URL to its generated thumbnail URL. */
export function toThumbnailUrl(value: unknown): string | undefined {
  const url = firstUrl(value);
  if (!url) return undefined;
  if (/_thumb\.webp(?:\?|#|$)/i.test(url)) return url;
  return url.replace(/\.webp(?=\?|#|$)/i, "_thumb.webp");
}

export function productThumb(product: unknown): string | undefined {
  if (!product || typeof product !== "object") return undefined;
  const p = product as Record<string, unknown>;
  return (
    firstUrl(p.thumbnailUrl) ||
    firstUrl(p.thumbnail) ||
    firstUrl(p.imageThumbnails) ||
    toThumbnailUrl(p.imageUrl) ||
    toThumbnailUrl(p.images) ||
    firstUrl(p.imageUrl) ||
    firstUrl(p.image) ||
    firstUrl(p.images)
  );
}

export function productImage(product: unknown): string | undefined {
  if (!product || typeof product !== "object") return undefined;
  const p = product as Record<string, unknown>;
  return firstUrl(p.imageUrl) || firstUrl(p.image) || firstUrl(p.images) || productThumb(product);
}

export function orderItemImage(item: unknown): string | undefined {
  if (!item || typeof item !== "object") return undefined;
  const value = item as Record<string, unknown>;
  return (
    firstUrl(value.thumbnailUrl) ||
    firstUrl(value.thumbnail) ||
    firstUrl(value.imageThumbnails) ||
    toThumbnailUrl(value.image) ||
    toThumbnailUrl(value.imageUrl) ||
    firstUrl(value.image) ||
    firstUrl(value.imageUrl) ||
    firstUrl(value.images) ||
    (value.product ? productThumb(value.product) : undefined)
  );
}
