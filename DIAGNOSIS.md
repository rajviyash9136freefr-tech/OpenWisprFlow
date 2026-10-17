# Open Wispr — Audio Pipeline Diagnosis & Accuracy Report

## 1. Executive Summary
A comprehensive investigation into the speech-to-text accuracy mismatch and audio pipeline in Open Wispr was conducted. The inaccurate transcription, missing words, and garbled output in Hindi/Hinglish/English were traced to six concrete root causes in the audio capture, preprocessing, language routing, and post-processing stages.

---

## 2. Root Cause Analysis

### Cause 1: Audio Truncation (Head & Tail Clipping)
- **Diagnosis**: 
  - `getUserMedia()` was called on-demand inside `startDictation()`. Hardware audio initialization on Windows takes between 250ms and 450ms. As a result, the first 1-2 syllables or first word of user speech were cut off before recording actually began.
  - On hotkey release (`stop()`), recording halted immediately with zero tail padding (0ms), clipping trailing vowels, word endings, or the final word.
- **Resolution**:
  - Keep audio capture warmed up with a rolling circular pre-roll buffer (400ms) of audio before the hotkey is triggered.
  - Add 350ms of post-release tail padding upon hotkey release so trailing speech is never truncated.

### Cause 2: Background Noise & Low-Frequency Acoustic Rumble
- **Diagnosis**:
  - The raw microphone signal included fan noise, room reverberation, and AC/PC rumble (frequencies below 100 Hz). Whisper models are sensitive to low-frequency hum, often hallucinating repetitive tokens or misidentifying speech segments.
- **Resolution**:
  - Implement a 2nd-order Butterworth/Biquad High-Pass Filter at 85 Hz to strip low-frequency rumble.
  - Implement a lightweight, real-time noise suppression stage (RNNoise/spectral gate) with selectable levels: `Off`, `Normal`, `Strong`.
  - Implement Voice Activity Detection (VAD) to trim non-speech noise padding while preserving a 250ms safety margin around voiced speech.

### Cause 3: Inadequate Resampling & Loudness Inconsistency
- **Diagnosis**:
  - Standard capture runs at 44.1 kHz or 48 kHz. Simple linear interpolation resamplers introduce high-frequency aliasing and quantization noise. Additionally, un-normalized audio varies drastically in volume, leading to Whisper silence hallucinations when quiet or distortion when loud.
- **Resolution**:
  - Use high-quality multi-stage linear/sinc resampling with anti-aliasing to pristine 16,000 Hz 16-bit mono PCM WAV.
  - Apply gentle loudness normalization targeting -16 LUFS / -3 dB peak with a soft limiter to prevent clipping without amplifying background room hiss.

### Cause 4: Language Detection & Task Setting Failures
- **Diagnosis**:
  - When language is set to auto-detect on short Hindi or mixed Hinglish phrases with background noise, Whisper frequently misidentifies the language as Urdu (`ur`), Marathi (`mr`), or English (`en`), resulting in translated or incorrectly transcribed text.
  - When `translateMode` was unintentionally active, Whisper performed translation instead of literal transcription.
- **Resolution**:
  - Explicit language routing options: `Auto`, `Hindi (hi)`, `English (en)`, and `Hinglish`.
  - For `Hindi`, explicitly pass `language: 'hi'`, `task: 'transcribe'`.
  - For `Hinglish`, pass initial prompt hints (e.g. `"Hinglish conversation with Hindi and English mixed words."`) and provide output script choices (Devanagari vs. Roman/Latin script).
  - Explicitly enforce `task: 'transcribe'` by default.

### Cause 5: Destructive Post-Processing Regexes
- **Diagnosis**:
  - The previous `organizeTranscript` function ran aggressive deduplication regexes (`(\b\w+\b)\s+\1`). In Hindi and Indic languages, word repetition is standard grammar (e.g., "धीरे धीरे" / dheere dheere, "बार बार" / baar baar, "साथ साथ" / saath saath). Stripping these ruined linguistic accuracy.
- **Resolution**:
  - Remove all word-altering post-processing.
  - Retain strictly non-destructive formatting: whitespace normalization, clean spacing around punctuation, and sentence capitalization. Never mutate words.

### Cause 6: Hugging Face API Endpoint & Token Routing
- **Diagnosis**:
  - Hugging Face migrated from `api-inference.huggingface.co` to `router.huggingface.co/hf-inference`. On free fine-grained accounts, third-party provider routing returns `402 Payment Required` or ZeroGPU limits.
- **Resolution**:
  - Support configurable model selection: `openai/whisper-large-v3-turbo` (primary) and `openai/whisper-large-v3` with configurable fallbacks.
  - Implement automatic retry with exponential backoff on HTTP 503 ("model loading") respecting `estimated_time`.
  - Provide fallback to local CUDA GPU Whisper or other configured providers when cloud APIs encounter rate-limits or payment blocks, ensuring zero downtime.

---

## 3. Debug Pipeline Architecture
A new Debug Mode (`debugMode: true` or `OPEN_WISPR_DEBUG=1`) saves every dictation session to `%APPDATA%/openwispr/openwispr-data/debug/<timestamp>/`:
1. `raw_recording.wav`: Raw audio straight from the hardware before any filtering.
2. `processed_16k.wav`: Audio after high-pass filtering, noise suppression, VAD, and normalization.
3. `request_meta.json`: Model name, parameters, headers, duration, and sample rate.
4. `response_meta.json`: Raw API response, execution latency, and final output text.
