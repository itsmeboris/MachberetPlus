import type { FormulaProgress } from "./protocol";

export const MODEL_REVISION = "1cef9f0bdcd6a4c63df7de1311fb0894593340cc";
export const MODEL_BASE = `https://huggingface.co/breezedeus/pix2text-mfr-1.5/resolve/${MODEL_REVISION}/`;
const sizes = {
  "encoder_model.onnx": 87510770,
  "decoder_model.onnx": 32026253,
  "tokenizer.json": 113168,
  "preprocessor_config.json": 450,
  "config.json": 1573,
} as const;
export type ModelFile = keyof typeof sizes;
type DownloadProgress = Extract<FormulaProgress, { phase: "download" }>;

export async function loadModelFile(
  file: ModelFile,
  progress: (event: DownloadProgress) => void,
): Promise<ArrayBuffer> {
  const url = MODEL_BASE + file;
  let cache: Cache | undefined;
  try {
    cache = await caches.open(`machberet-pix2text-${MODEL_REVISION}`);
  } catch {
    /* Private mode or quota: download directly. */
  }
  try {
    const cached = await cache?.match(url);
    if (cached) {
      const buffer = await cached.arrayBuffer();
      if (buffer.byteLength === sizes[file]) {
        progress({
          phase: "download",
          file,
          loaded: buffer.byteLength,
          total: sizes[file],
        });
        return buffer;
      }
      await cache?.delete(url);
    }
  } catch {
    /* Cache reads must not prevent an online retry. */
  }
  const response = await fetch(url, {
    credentials: "omit",
    referrerPolicy: "no-referrer",
  });
  if (!response.ok)
    throw new Error(
      `Model download failed (${response.status}). Please retry online.`,
    );
  // A fixed buffer prevents retaining both every network chunk and a joined
  // copy while CacheStorage constructs its response on memory-limited devices.
  const buffer = new Uint8Array(sizes[file]);
  let loaded = 0;
  let lastProgress = -Infinity;
  const report = (complete = false) => {
    const now = performance.now();
    if (complete || now - lastProgress >= 100) {
      progress({ phase: "download", file, loaded, total: sizes[file] });
      lastProgress = now;
    }
  };
  if (response.body) {
    const reader = response.body.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (loaded + value.byteLength > sizes[file]) {
          await reader.cancel().catch(() => {});
          throw new Error(
            "Model download exceeds its expected size. Please retry online.",
          );
        }
        buffer.set(value, loaded);
        loaded += value.byteLength;
        report();
      }
    } finally {
      reader.releaseLock();
    }
  } else {
    const value = new Uint8Array(await response.arrayBuffer());
    if (value.byteLength > sizes[file])
      throw new Error(
        "Model download exceeds its expected size. Please retry online.",
      );
    buffer.set(value);
    loaded = value.byteLength;
  }
  if (loaded !== sizes[file])
    throw new Error("Incomplete model download. Please retry online.");
  report(true);
  try {
    await cache?.put(url, new Response(buffer));
  } catch {
    /* Inference can proceed without a persistent cache. */
  }
  return buffer.buffer;
}
