import sys
import os
import whisper
import torch
import warnings
warnings.filterwarnings("ignore")

device = "cuda:0" if torch.cuda.is_available() else "cpu"
print(f"[WhisperWorker] Loading model 'base' on {device}...")
model = whisper.load_model("base", device=device)
print("[WhisperWorker] Model ready!")

def transcribe_file(file_path, language=None):
    if not os.path.exists(file_path):
        return "Error: File not found"
    options = {}
    if language and language != "auto":
        options["language"] = language
    result = model.transcribe(file_path, **options)
    return result["text"].strip()

if __name__ == "__main__":
    if len(sys.argv) > 1:
        audio_file = sys.argv[1]
        lang = sys.argv[2] if len(sys.argv) > 2 else None
        text = transcribe_file(audio_file, lang)
        print(f"RESULT:{text}")
    else:
        print("Usage: python whisper_service.py <audio_file> [language]")
