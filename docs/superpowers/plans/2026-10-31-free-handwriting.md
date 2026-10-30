# Free on-device handwriting recognition

User requests research and implementation of a free handwriting OCR model; earlier design-question waiver remains in effect. Prioritize handwritten math from the two supplied photographs, distinguish it from Hebrew prose, and do not imply a hosted free tier is unlimited free inference.

1. Research primary model cards, weights licenses, runtime and mobile download requirements. Benchmark candidates locally against both private photos; report raw mistakes, not only selected successes.
2. Choose a useful permissively licensed formula model. Run inference in a browser worker with pinned cached model downloads, progress and cancellation, no worksheet upload and no automatic paid fallback. Preserve teacher correction and explicit cloud opt-in.
3. Provide crop/line preparation suitable for formula models. Preserve source image and surface recognition scope/limitations. Do not invent corrected symbols to satisfy a benchmark.
4. Test decoding, preprocessing, error/cancel paths, real-model browser inference, network privacy and capture integration. Build, review, deploy, live smoke with private images kept outside Git. Document actual sample accuracy and resource costs.

Candidate research: Pix2Text quantized v1 (53 MB) and original v1.5 (119 MB), MIT; TrOCR IAM handwriting is not a math/Hebrew model; PP-FormulaNet needs larger runtime; Hebrew Mishkefet has a noncommercial license and needs separate consideration.

Completed: selected v1.5 after quantized v1 misread a digit. All six equations in both uncropped private photos passed the actual browser and deployed local model, without photo uploads and with cached second-photo host blocking. 69 unit/API tests, 21 browser tests, build and review passed. Cancellation/mixed-fraction findings fixed and re-reviewed. Deployment `1a8c25d8-fd1e-4440-b3eb-f94e84014dd1`; no migrations. See free-handwriting.md for evidence and limitations.
