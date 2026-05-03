// Client-side image compression — keeps quality high while shrinking storage size.
// Default: max 800px, JPEG quality 0.82, output WebP if supported (smaller).
export async function compressImage(
  file: File,
  opts: { maxSize?: number; quality?: number; mimeType?: "image/webp" | "image/jpeg" } = {}
): Promise<Blob> {
  const maxSize = opts.maxSize ?? 800;
  const quality = opts.quality ?? 0.82;
  const mimeType = opts.mimeType ?? "image/webp";

  const img = await loadImage(file);
  const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
  const w = Math.round(img.width * ratio);
  const h = Math.round(img.height * ratio);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
      mimeType,
      quality
    );
  });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}
