# Free handwriting OCR research and implementation — 2026-10-31

Selected **Pix2Text-MFR-1.5**, running entirely inside a browser worker with ONNX Runtime Web. No inference API, account key, per-page payment or paid fallback is involved. This addresses the supplied handwritten math photographs; it is not a general Hebrew handwriting recognizer.

## Candidate comparison

| Candidate | License / artifacts | Decision |
|---|---|---|
| [Pix2Text quantized v1](https://huggingface.co/Brian314/pix2text-mfr-quantized) | MIT, about 53 MB of ONNX weights | Tested locally. Read the first two cropped equations correctly but read the final handwritten `4` as `y`; contrast/threshold variants also made errors. Not selected. |
| [Pix2Text-MFR-1.5](https://huggingface.co/breezedeus/pix2text-mfr-1.5) | MIT, about 120 MB of ONNX weights/tokenizer | Selected after six exact equations from both photos passed through the actual browser. Designed for mathematical formula images and emits LaTeX. |
| [TrOCR small handwritten](https://huggingface.co/microsoft/trocr-small-handwritten) | IAM handwriting checkpoint, available browser conversions | General line handwriting is not evidence of mathematical or Hebrew accuracy; preferred the math-specialized model. Not benchmarked. |
| [PP-FormulaNet plus-S](https://huggingface.co/PaddlePaddle/PP-FormulaNet_plus-S) | Apache-2.0, roughly 257 MB Paddle weights | Larger runtime/conversion burden for this browser pilot. Not benchmarked. |
| [SmolVLM-256M](https://huggingface.co/HuggingFaceTB/SmolVLM-256M-Instruct) | Apache-2.0, browser ONNX variants | A general vision model; no evidence here that it is a better handwriting transcriber. Not benchmarked. |
| [Mishkefet-v1](https://huggingface.co/itayinbar/Mishkefet-v1/raw/main/README.md) | Modern Hebrew cursive, ONNX artifacts; current metadata and licensing section CC-BY-NC-SA-4.0 | Relevant future Hebrew candidate, not integrated. Noncommercial restriction and reported recognition errors require separate evaluation. Some cached/older card text claims a different license; current explicit license governs this decision. |

## Actual sample evidence

The first native CPU comparison used manually cropped equation lines. Quantized v1 produced `x+5=12`, `2x+7=8`, `3x-6=y`. Original v1.5 produced `x+5=12`, `2x+7=8`, `3x-6=4`.

The implemented browser pipeline then read the **original uncropped photographs**, automatically found the paper boundary, rectified perspective and separated the three lines. Both the straight and tilted photos produced all three equations exactly. Observed development-browser time was 18.3 seconds for the first recognition with model preparation/download, and 4.0 seconds for the second with cached weights. These are desktop Chromium measurements, not Android performance promises, and two photographs do not establish broad accuracy.

The opt-in `tests/e2e/free-handwriting.spec.ts` uses `PILOT_PHOTO_DIR`; private photos and derived crops remain outside Git. It verifies exact answers, zero POST/upload requests during recognition, and success on the second photo with the model-download host blocked. The three equations are test expectations only, never production model outputs or preprocessing constants.

The same test passed on deployed version `1a8c25d8-fd1e-4440-b3eb-f94e84014dd1`: 19.8 seconds first run and 4.0 seconds cached. Its synthetic account was deleted. Full local checks passed: 69 unit/API tests, 21 browser tests and production build. Review caught cancellation and mixed-fraction normalization issues; regression fixes passed re-review.

## Runtime and data handling

- Pin model revision `1cef9f0bdcd6a4c63df7de1311fb0894593340cc`; model files download directly from the author's Hugging Face repository with no cookies or referrer. We do not use Hugging Face hosted inference.
- Weights: encoder 87,510,770 bytes, decoder 32,026,253 bytes, tokenizer 113,168 bytes. The bundled CPU WASM runtime is another 14.85 MB: about 135 MB total on first use. Runtime and model are lazy-loaded, not part of initial app startup.
- Cache model files by immutable revision using CacheStorage. Missing/evicted caches require a new download. Quota/private-mode errors allow inference without persistent caching. Every download has a hard byte-size bound; progress is throttled and the worker can be terminated at any stage.
- CPU/WASM uses one thread, without WebGPU, SharedArrayBuffer or cross-origin isolation requirements. Inputs are bounded 384×384 RGB line images. Greedy generation stops at EOS or rejects at 256 tokens; at most 30 lines per run.
- Recognition does not upload the image. Normal explicit draft saving still stores its source through the existing authenticated app API; this feature does not change that storage behavior. Cloud recognition is a separately selected, explicitly approved option, never an automatic fallback.
- Paper detection assumes mostly uniform paper near the image center and darker ink, with reasonably upright orientation. Ambiguous boundaries ask for manual crop/rotation. Dense diagrams, multi-column pages, ruled backgrounds and mixed Hebrew prose need broader evaluation. Complex unsupported LaTeX and ambiguous mixed fractions are rejected without replacing existing exercises.
- The teacher must check every proposal, including all digits/signs. No automatic solving, grading or confidence claim is made. Ordinary connectivity/data, device storage, CPU and battery still have costs; "free" here means no model license fee or per-recognition API charge.

Notices ship at `/ocr-licenses.txt`. The original source and edits survive cancellation/errors; navigating away aborts saved-source loading and worker activity.
