import * as ort from "onnxruntime-web/wasm";
import wasmUrl from "onnxruntime-web/ort-wasm-simd-threaded.wasm?url";
import wasmModuleUrl from "onnxruntime-web/ort-wasm-simd-threaded.mjs?url";
import { decodeTokens, greedyGenerate, normalizePixels } from "./decode";
import { loadModelFile } from "./model";
import type {
  FormulaProgress,
  FormulaRequest,
  FormulaResponse,
} from "./protocol";

// One CPU thread works without SharedArrayBuffer or cross-origin isolation.
ort.env.wasm.numThreads = 1;
ort.env.wasm.proxy = false;
ort.env.wasm.wasmPaths = { wasm: wasmUrl, mjs: wasmModuleUrl };

const send = (message: FormulaResponse) => globalThis.postMessage(message);
const progress = (event: FormulaProgress) =>
  send({ type: "progress", progress: event });

globalThis.onmessage = async ({ data }: MessageEvent<FormulaRequest>) => {
  let encoder: ort.InferenceSession | undefined;
  let decoder: ort.InferenceSession | undefined;
  try {
    if (!data.lines.length || data.lines.length > 30)
      throw new Error("Invalid formula line count.");
    const tokenizerBytes = await loadModelFile("tokenizer.json", progress);
    const tokenizer = JSON.parse(new TextDecoder().decode(tokenizerBytes)) as {
      model: { vocab: Record<string, number> };
    };
    const encoderBytes = await loadModelFile("encoder_model.onnx", progress);
    progress({ phase: "loading" });
    encoder = await ort.InferenceSession.create(encoderBytes, {
      executionProviders: ["wasm"],
    });
    const decoderBytes = await loadModelFile("decoder_model.onnx", progress);
    progress({ phase: "loading" });
    decoder = await ort.InferenceSession.create(decoderBytes, {
      executionProviders: ["wasm"],
    });
    const lines: string[] = [];
    progress({ phase: "recognize", completed: 0, total: data.lines.length });
    for (const line of data.lines) {
      if (
        line.width !== 384 ||
        line.height !== 384 ||
        line.pixels.byteLength !== 384 * 384 * 4
      )
        throw new Error("Invalid formula image dimensions.");
      const input = new ort.Tensor(
        "float32",
        normalizePixels(new Uint8ClampedArray(line.pixels)),
        [1, 3, 384, 384],
      );
      let encoded: ort.InferenceSession.OnnxValueMapType | undefined;
      try {
        encoded = await encoder.run({ pixel_values: input });
        const hidden = encoded[encoder.outputNames[0]];
        const tokens = await greedyGenerate(async (ids) => {
          const inputIds = new ort.Tensor(
            "int64",
            BigInt64Array.from(ids.map(BigInt)),
            [1, ids.length],
          );
          let outputs: ort.InferenceSession.OnnxValueMapType | undefined;
          try {
            outputs = await decoder!.run({
              input_ids: inputIds,
              encoder_hidden_states: hidden,
            });
            const logits = outputs[decoder!.outputNames[0]];
            if (!(logits.data instanceof Float32Array))
              throw new Error("Unexpected formula logits");
            return { data: logits.data.slice(), dims: logits.dims };
          } finally {
            inputIds.dispose();
            if (outputs)
              for (const tensor of Object.values(outputs)) tensor.dispose();
          }
        });
        const text = decodeTokens(tokens, tokenizer.model.vocab);
        if (!text)
          throw new Error(
            "No formula recognized in this line. Try a clearer crop.",
          );
        lines.push(text);
      } finally {
        input.dispose();
        if (encoded)
          for (const tensor of Object.values(encoded)) tensor.dispose();
      }
      progress({
        phase: "recognize",
        completed: lines.length,
        total: data.lines.length,
      });
    }
    send({ type: "result", lines });
  } catch (error) {
    send({
      type: "error",
      message:
        error instanceof Error
          ? error.message
          : "Local formula recognition failed.",
    });
  } finally {
    await decoder?.release();
    await encoder?.release();
  }
};
