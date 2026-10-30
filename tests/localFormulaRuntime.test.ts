import { afterEach, expect, it, vi } from "vitest";
import { recognizeFormulaLines } from "../src/features/capture/local-formula/runtime";

class FakeWorker {
  static current: FakeWorker;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  terminated = false;
  constructor() {
    FakeWorker.current = this;
  }
  postMessage() {}
  terminate() {
    this.terminated = true;
  }
}
afterEach(() => vi.unstubAllGlobals());
const line = () =>
  ({
    width: 384,
    height: 384,
    data: new Uint8ClampedArray(384 * 384 * 4),
  }) as ImageData;

it("terminates inference immediately when cancelled", async () => {
  vi.stubGlobal("Worker", FakeWorker);
  const controller = new AbortController();
  const pending = recognizeFormulaLines([line()], () => {}, controller.signal);
  controller.abort();
  await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  expect(FakeWorker.current.terminated).toBe(true);
});

it("reports worker startup errors and releases resources", async () => {
  vi.stubGlobal("Worker", FakeWorker);
  const pending = recognizeFormulaLines(
    [line()],
    () => {},
    new AbortController().signal,
  );
  FakeWorker.current.onerror?.();
  await expect(pending).rejects.toThrow(/worker/i);
  expect(FakeWorker.current.terminated).toBe(true);
});

it("returns lines in order without detaching caller pixels", async () => {
  vi.stubGlobal("Worker", FakeWorker);
  const input = line();
  const pending = recognizeFormulaLines(
    [input],
    () => {},
    new AbortController().signal,
  );
  FakeWorker.current.onmessage?.({
    data: { type: "result", lines: ["x+5=12"] },
  });
  expect(await pending).toEqual(["x+5=12"]);
  expect(input.data.length).toBe(589824);
  expect(FakeWorker.current.terminated).toBe(true);
});

it("rejects oversized batches and unprepared images", async () => {
  const signal = new AbortController().signal;
  await expect(
    recognizeFormulaLines(Array.from({ length: 31 }, line), () => {}, signal),
  ).rejects.toThrow(/30/);
  await expect(
    recognizeFormulaLines([{ ...line(), width: 10 }], () => {}, signal),
  ).rejects.toThrow(/384/);
});
