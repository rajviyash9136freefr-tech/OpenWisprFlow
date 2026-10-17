import sys
import os
import json
import time
import warnings
warnings.filterwarnings("ignore")

import torch
import whisper

def main():
    device = "cuda:0" if torch.cuda.is_available() else "cpu"
    sys.stderr.write(f"[WhisperDaemon] Initializing on {device}...\n")
    sys.stderr.flush()

    # Default to 'small' for ultra-fast (300ms) accurate 100-language support without VRAM bloat
    model_name = os.environ.get("WHISPER_MODEL", "small")
    sys.stderr.write(f"[WhisperDaemon] Loading model '{model_name}' on {device}...\n")
    sys.stderr.flush()

    try:
        model = whisper.load_model(model_name, device=device)
    except Exception as e:
        sys.stderr.write(f"[WhisperDaemon] Failed to load '{model_name}': {e}. Falling back to 'small'...\n")
        model = whisper.load_model("small", device=device)
        model_name = "small"

    sys.stderr.write(f"[WhisperDaemon] Model '{model_name}' loaded successfully on {device}!\n")
    sys.stderr.flush()

    # Notify Electron that daemon is ready
    print("READY", flush=True)

    # Process line-by-line requests from stdin
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        if line == "PING":
            print("PONG", flush=True)
            continue
        if line == "EXIT":
            break

        try:
            req = json.loads(line)
            audio_path = req.get("audioPath")
            language = req.get("language")
            task = req.get("task", "transcribe") # "transcribe" or "translate"
            prompt = req.get("prompt") # None by default to prevent hallucinations

            if not audio_path or not os.path.exists(audio_path):
                print(json.dumps({"error": f"File not found: {audio_path}"}), flush=True)
                continue

            t0 = time.time()
            options = {
                "fp16": torch.cuda.is_available(),
                "temperature": 0.0, # Deterministic greedy search, avoids hallucinations
                "condition_on_previous_text": False, # Prevents repetitive loops and hallucinations
                "compression_ratio_threshold": 2.4,
                "task": task if task in ["transcribe", "translate"] else "transcribe",
            }

            if language and language not in ["auto", "mixed", "universal", "all"]:
                options["language"] = language

            if prompt and str(prompt).strip():
                options["initial_prompt"] = str(prompt).strip()

            result = model.transcribe(audio_path, **options)
            elapsed = time.time() - t0

            response = {
                "text": result.get("text", "").strip(),
                "duration": elapsed,
                "language": result.get("language", language or "auto"),
                "task": task
            }
            print(json.dumps(response), flush=True)

        except Exception as e:
            sys.stderr.write(f"[WhisperDaemon] Error: {e}\n")
            sys.stderr.flush()
            print(json.dumps({"error": str(e)}), flush=True)

if __name__ == "__main__":
    main()
