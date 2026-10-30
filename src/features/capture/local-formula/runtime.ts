import type {
  FormulaProgress,
  FormulaRequest,
  FormulaResponse,
} from "./protocol";
export type { FormulaProgress } from "./protocol";

/** Input lines are already cropped, opaque, and bicubic resized to 384 × 384. */
export async function recognizeFormulaLines(
  lines: ImageData[],
  onProgress: (progress: FormulaProgress) => void,
  signal: AbortSignal,
): Promise<string[]> {
  signal.throwIfAborted();
  if (lines.length > 30)
    throw new Error("Recognize at most 30 formula lines at a time.");
  if (!lines.length) return [];
  if (
    lines.some(
      (line) =>
        line.width !== 384 ||
        line.height !== 384 ||
        line.data.length !== 384 * 384 * 4,
    )
  ) {
    throw new Error("Formula lines must be prepared at 384 × 384 pixels.");
  }
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });
    const cleanup = () => {
      worker.terminate();
      signal.removeEventListener("abort", abort);
    };
    const fail = (error: unknown) => {
      cleanup();
      reject(error);
    };
    const abort = () =>
      fail(new DOMException("Formula recognition cancelled", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    worker.onerror = () =>
      fail(
        new Error(
          "Formula worker could not load or run. Please retry in a supported browser.",
        ),
      );
    worker.onmessageerror = () =>
      fail(new Error("Formula worker returned an unreadable response."));
    worker.onmessage = ({ data }: MessageEvent<FormulaResponse>) => {
      if (data.type === "progress") onProgress(data.progress);
      else if (data.type === "error") fail(new Error(data.message));
      else {
        cleanup();
        resolve(data.lines);
      }
    };
    try {
      const payload: FormulaRequest = {
        lines: lines.map((line) => ({
          width: line.width,
          height: line.height,
          pixels: line.data.slice().buffer,
        })),
      };
      worker.postMessage(
        payload,
        payload.lines.map((line) => line.pixels),
      );
    } catch (error) {
      fail(error);
    }
  });
}
