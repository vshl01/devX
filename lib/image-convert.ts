/**
 * Sarvam Document AI reads PDF, JPG and PNG only. Phone cameras hand out HEIC
 * and browsers hand out WebP, so anything else is decoded here and re-encoded
 * as JPEG before it leaves the page. The browser already has the codecs: Safari
 * decodes HEIC, and every target browser decodes WebP.
 */

/** What Sarvam accepts as-is. */
const PASS_THROUGH = new Set(["application/pdf", "image/jpeg", "image/jpg", "image/png"]);

/** Long edge cap. Above this, OCR gains nothing and the upload just gets slower. */
const MAX_EDGE = 3000;
const JPEG_QUALITY = 0.92;

export class UnreadableImageError extends Error {
  constructor() {
    super("This image format could not be read. Save it as JPG or PNG and try again.");
    this.name = "UnreadableImageError";
  }
}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // Falls through to the <img> path, which handles a few formats
      // `createImageBitmap` refuses.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new UnreadableImageError());
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Returns a file Sarvam can read. PDFs, JPEGs and PNGs pass straight through;
 * everything else is re-encoded, and an undecodable image throws rather than
 * failing later as a confusing upstream rejection.
 */
export async function toReadableDocument(file: File): Promise<File> {
  if (PASS_THROUGH.has(file.type)) return file;

  const source = await decode(file);
  const width = "width" in source ? source.width : 0;
  const height = "height" in source ? source.height : 0;
  if (!width || !height) throw new UnreadableImageError();

  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);

  const context = canvas.getContext("2d");
  if (!context) throw new UnreadableImageError();

  // A white ground: a transparent PNG flattened onto black would be unreadable.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);

  if ("close" in source) source.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
  );
  if (!blob) throw new UnreadableImageError();

  const stem = file.name.replace(/\.[^.]*$/, "") || "photo";
  return new File([blob], `${stem}.jpg`, { type: "image/jpeg" });
}
