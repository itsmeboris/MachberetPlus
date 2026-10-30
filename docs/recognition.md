# Worksheet recognition

The original pilot used Tesseract.js for printed Hebrew. It was not suitable for the user's handwritten photographs. A separate math extraction bug also discarded a leading variable (`x + 5 = 12` became `5 = 12`); the parser now preserves it and filters isolated noisy symbols/digits.

Handwriting/photo mode uses Cloudflare Workers AI `@cf/qwen/qwen3.8-27b`. The teacher explicitly confirms transmitting the image; no transmission occurs merely on file selection. The authenticated teacher endpoint accepts only bounded image data, applies rate limiting and validates structured proposals. It cannot solve, grade, approve or distribute work. Printed-page recognition remains available locally.

The browser compresses an image to at most 1600 pixels along its longest edge and a bounded request size. The original source used for the assignment is kept separately. The server does not store the inference request or model response as an extra worksheet record. Provider processing is subject to the provider's data-use terms.

## Supplied-photo benchmark

Direct provider checks on 2026-10-30 read both original user photographs (tilted and straight-on) as exactly:

```
x + 5 = 12
2x + 7 = 8
3x - 6 = 4
```

Observed direct response times were 4.9 and 6.3 seconds. The live browser test subsequently passed for both photos against the deployed app (14 seconds for the two-photo test including setup and cleanup). This is evidence for those two images, not a general handwriting-accuracy claim. The private photographs are not stored in Git or public app assets. The opt-in `tests/live/handwriting.spec.ts` reads them from `PILOT_PHOTO_DIR` to verify the complete browser-to-deployed-API path, and otherwise skips.

More complex Hebrew handwriting, diagrams, crowded pages and poor lighting need representative evaluation. The teacher must check every result and can edit or enter exercises manually. Recognition failure preserves the selected image and existing exercises.

Provider references: [model and input/output schema](https://developers.cloudflare.com/workers-ai/models/qwen3.8-27b/), [data usage](https://developers.cloudflare.com/workers-ai/platform/data-usage/).
