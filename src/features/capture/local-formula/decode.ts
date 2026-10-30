export function decodeTokens(
  tokens: number[],
  vocab: Record<string, number>,
): string {
  // GPT-2 ByteLevel uses printable Unicode stand-ins for all 256 bytes.
  const bytes = Array.from({ length: 256 }, (_, i) => i).filter(
    (b) => (b >= 33 && b <= 126) || (b >= 161 && b <= 172) || b >= 174,
  );
  const unicode = [...bytes];
  let extra = 0;
  for (let b = 0; b < 256; b++) {
    if (!bytes.includes(b)) {
      bytes.push(b);
      unicode.push(256 + extra++);
    }
  }
  const inverse = new Map(
    unicode.map((char, i) => [String.fromCodePoint(char), bytes[i]]),
  );
  const byId = new Map(Object.entries(vocab).map(([token, id]) => [id, token]));
  const decoded: number[] = [];
  for (const id of tokens) {
    if (id <= 4) continue;
    const token = byId.get(id);
    if (token === undefined) throw new Error("Unknown formula token");
    for (const char of token) {
      const byte = inverse.get(char);
      if (byte === undefined) throw new Error("Invalid formula tokenizer");
      decoded.push(byte);
    }
  }
  return new TextDecoder("utf-8", { fatal: true })
    .decode(new Uint8Array(decoded))
    .trim();
}

export async function greedyGenerate(
  step: (
    ids: number[],
  ) => Promise<{ data: Float32Array; dims: readonly number[] }>,
  maxTokens = 256,
): Promise<number[]> {
  const ids = [1];
  for (let i = 0; i < maxTokens; i++) {
    const { data, dims } = await step(ids);
    const size = dims[2];
    if (!size || data.length < size) throw new Error("Invalid decoder output");
    const start = data.length - size;
    let best = 0;
    for (let j = 1; j < size; j++)
      if (data[start + j] > data[start + best]) best = j;
    ids.push(best);
    if (best === 2) return ids;
  }
  throw new Error(
    "Formula exceeds the token limit; crop a shorter line and retry.",
  );
}

export function normalizePixels(pixels: Uint8ClampedArray): Float32Array {
  const count = pixels.length / 4;
  const result = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    for (let channel = 0; channel < 3; channel++)
      result[channel * count + i] = pixels[i * 4 + channel] / 127.5 - 1;
  }
  return result;
}
