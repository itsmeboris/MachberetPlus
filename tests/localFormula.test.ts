import { afterEach, expect, it, vi } from "vitest";
import {
  decodeTokens,
  greedyGenerate,
  normalizePixels,
} from "../src/features/capture/local-formula/decode";
import { loadModelFile } from "../src/features/capture/local-formula/model";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
const configBody = "{}".padEnd(1573, " ");

it("decodes byte-level spaces and UTF-8, skipping special tokens", () => {
  expect(decodeTokens([1, 5, 6, 7, 2], { x: 5, "Ġ+Ġ": 6, ÏĢ: 7 })).toBe(
    "x + π",
  );
});

it("greedily reads the final sequence position and stops at EOS", async () => {
  let calls = 0;
  const tokens = await greedyGenerate(async (ids) => {
    calls++;
    const logits = new Float32Array(ids.length * 8).fill(-10);
    logits[0] = 999;
    logits[(ids.length - 1) * 8 + (calls === 1 ? 5 : 2)] = 1000;
    return { data: logits, dims: [1, ids.length, 8] };
  }, 3);
  expect(tokens).toEqual([1, 5, 2]);
  expect(calls).toBe(2);
});

it("refuses a token-limit truncation", async () => {
  await expect(
    greedyGenerate(
      async () => ({
        data: new Float32Array([0, 0, 0, 0, 0, 1]),
        dims: [1, 1, 6],
      }),
      2,
    ),
  ).rejects.toThrow(/limit/i);
});

it("normalizes RGB into channel-first values", () => {
  expect(
    Array.from(
      normalizePixels(
        new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 255, 255]),
      ),
    ),
  ).toEqual([1, -1, -1, 1, -1, 1]);
});

it("downloads even when cache storage is unavailable", async () => {
  vi.stubGlobal("caches", {
    open: async () => {
      throw new Error("denied");
    },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(configBody)),
  );
  const progress: number[] = [];
  expect(
    new TextDecoder().decode(
      await loadModelFile("config.json", (e) => progress.push(e.loaded)),
    ),
  ).toBe(configBody);
  expect(progress.at(-1)).toBe(1573);
});

it("rejects partial model weights before inference", async () => {
  vi.stubGlobal("caches", undefined);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(new Uint8Array([1, 2]))),
  );
  await expect(loadModelFile("encoder_model.onnx", () => {})).rejects.toThrow(
    /incomplete/i,
  );
});

it("uses pinned cached files without requiring network access", async () => {
  vi.stubGlobal("caches", {
    open: async () => ({ match: async () => new Response(" ".repeat(1573)) }),
  });
  const fetcher = vi.fn(async () => {
    throw new Error("offline");
  });
  vi.stubGlobal("fetch", fetcher);
  expect((await loadModelFile("config.json", () => {})).byteLength).toBe(1573);
  expect(fetcher).not.toHaveBeenCalled();
});

it("redownloads corrupt cache entries and tolerates quota exhaustion", async () => {
  let deleted = false;
  vi.stubGlobal("caches", {
    open: async () => ({
      match: async () => new Response("bad"),
      delete: async () => {
        deleted = true;
      },
      put: async () => {
        throw new Error("quota");
      },
    }),
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(configBody)),
  );
  expect(
    new TextDecoder().decode(await loadModelFile("config.json", () => {})),
  ).toBe(configBody);
  expect(deleted).toBe(true);
});

it("cancels oversized tokenizer streams before retaining further chunks", async () => {
  vi.stubGlobal("caches", undefined);
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(113169));
    },
    cancel() {
      cancelled = true;
    },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(body)),
  );
  // The stream intentionally stays open: size validation must reject immediately.
  await expect(loadModelFile("tokenizer.json", () => {})).rejects.toThrow(
    /size/i,
  );
  expect(cancelled).toBe(true);
});

it("rejects incomplete tokenizer files just like model weights", async () => {
  vi.stubGlobal("caches", undefined);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("{}")),
  );
  await expect(loadModelFile("tokenizer.json", () => {})).rejects.toThrow(
    /incomplete/i,
  );
});

it("throttles a burst of chunks while still reporting completed bytes", async () => {
  vi.stubGlobal("caches", undefined);
  vi.spyOn(performance, "now").mockReturnValue(0);
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < 450; i++) controller.enqueue(new Uint8Array([32]));
      controller.close();
    },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(body)),
  );
  const progress: number[] = [];
  expect(
    (
      await loadModelFile("preprocessor_config.json", (e) =>
        progress.push(e.loaded),
      )
    ).byteLength,
  ).toBe(450);
  expect(progress.at(-1)).toBe(450);
  expect(progress.length).toBeLessThanOrEqual(2);
});
