import { canvasBlob } from "./ImageEditor";
export async function pageFile(
  file: File,
  page = 1,
): Promise<{ blob: Blob; pages: number }> {
  if (file.size > 25 * 1024 * 1024) throw new Error("בחרו קובץ קטן מ־25MB");
  if (file.type === "application/pdf") {
    const lib = await import("pdfjs-dist");
    lib.GlobalWorkerOptions.workerSrc = (
      await import("pdfjs-dist/build/pdf.worker.min.mjs?url")
    ).default;
    const task = lib.getDocument({ data: await file.arrayBuffer() });
    const doc = await task.promise;
    try {
      if (page < 1 || page > doc.numPages)
        throw new Error("בחרו מספר עמוד תקין");
      const p = await doc.getPage(page);
      const base = p.getViewport({ scale: 1 });
      const viewport = p.getViewport({
        scale: Math.min(2, 1800 / Math.max(base.width, base.height)),
      });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await p.render({ canvas, viewport }).promise;
      return { blob: await canvasBlob(canvas), pages: doc.numPages };
    } finally {
      await task.destroy();
    }
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("בחרו תמונה או PDF");
  const img = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1800 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return { blob: await canvasBlob(canvas), pages: 1 };
  } finally {
    img.close();
  }
}
