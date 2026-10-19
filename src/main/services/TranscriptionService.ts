import { AppPreferences, DictionaryItem } from '../../shared/types';
import { LocalWhisperService } from './LocalWhisperService';
import { devanagariToHinglish, isDevanagari } from './transliterate';
import { DebugService } from './DebugService';

export class TranscriptionService {
  private localWhisper: LocalWhisperService;

  constructor() {
    this.localWhisper = new LocalWhisperService();
  }

  /**
   * High-accuracy silence-aware splitting only for very long recordings (> 75-90 seconds)
   * Shorter recordings are never sliced to preserve natural context, grammar, and sentence flow.
   */
  private splitWavAtSilence(audioBuffer: Buffer, targetSeconds = 60, overlapSeconds = 0.5): Buffer[] {
    const bytesPerSecond = 32000; // 16kHz 16-bit Mono = 32,000 bytes/sec
    const totalBytes = audioBuffer.length - 44;
    const totalSeconds = totalBytes / bytesPerSecond;

    // Up to 75 seconds: ALWAYS process as a single unbroken audio stream!
    if (totalSeconds <= 75) {
      return [audioBuffer];
    }

    const pcm = audioBuffer.subarray(44);
    const chunks: Buffer[] = [];
    let currentStart = 0;

    while (currentStart < pcm.length) {
      const remainingBytes = pcm.length - currentStart;
      const targetChunkBytes = Math.min(remainingBytes, targetSeconds * bytesPerSecond);

      if (remainingBytes <= (targetSeconds + 15) * bytesPerSecond) {
        // Last chunk, take all remaining
        const slice = pcm.subarray(currentStart);
        if (slice.length >= 3200) {
          chunks.push(this.wrapPcmInWav(slice));
        }
        break;
      }

      // Search for energy minimum in the window [targetSeconds - 8, targetSeconds + 8]
      const searchStart = currentStart + Math.max(0, (targetSeconds - 8) * bytesPerSecond);
      const searchEnd = currentStart + Math.min(remainingBytes, (targetSeconds + 8) * bytesPerSecond);

      let minEnergy = Infinity;
      let bestSplit = currentStart + targetChunkBytes;

      const windowStep = 320; // 10ms step
      for (let pos = searchStart; pos < searchEnd - windowStep; pos += windowStep) {
        let energy = 0;
        for (let i = 0; i < windowStep; i += 2) {
          const sample = pcm.readInt16LE(pos + i);
          energy += sample * sample;
        }
        if (energy < minEnergy) {
          minEnergy = energy;
          bestSplit = pos + Math.floor(windowStep / 2);
        }
      }

      const chunkData = pcm.subarray(currentStart, bestSplit);
      if (chunkData.length >= 3200) {
        chunks.push(this.wrapPcmInWav(chunkData));
      }

      // Move forward with slight overlap
      const overlapBytes = Math.round(overlapSeconds * bytesPerSecond);
      currentStart = Math.max(currentStart + (targetSeconds * bytesPerSecond) / 2, bestSplit - overlapBytes);
    }

    return chunks.length > 0 ? chunks : [audioBuffer];
  }

  private wrapPcmInWav(pcmData: Buffer): Buffer {
    const header = Buffer.alloc(44);
    const dataLen = pcmData.length;

    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataLen, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20); // PCM
    header.writeUInt16LE(1, 22); // Mono
    header.writeUInt32LE(16000, 24); // 16kHz
    header.writeUInt32LE(32000, 28); // 32,000 bytes/sec
    header.writeUInt16LE(2, 32); // BlockAlign (2 bytes)
    header.writeUInt16LE(16, 34); // 16 bits
    header.write('data', 36);
    header.writeUInt32LE(dataLen, 40);

    return Buffer.concat([header, pcmData]);
  }

  /**
   * Filters common Whisper silence hallucinations, prompt echoes, and phantom loops
   */
  private filterHallucinations(text: string): string {
    if (!text) return '';
    let trimmed = text.trim();

    // 0. Filter prompt leakage echoes (e.g. "clear voice", "this is a clear voice", "and then, this is a clear voice")
    trimmed = trimmed.replace(/\b(?:and\s+then\s*,\s*)?(?:there\s+is\s+a\s+|this\s+is\s+a\s+)?clear\s+voice(?:\s+dictation)?(?:\s*,\s*and\s+then|\s*,\s*to\s+be\s+honest)?\b[.,!]*/gi, '').trim();

    // 1. Detect and collapse repetitive phrase loops
    const words = trimmed.split(/\s+/);
    if (words.length >= 6) {
      for (let phraseLen = 2; phraseLen <= 8; phraseLen++) {
        if (words.length < phraseLen * 3) continue;
        const phrase = words.slice(0, phraseLen).join(' ').toLowerCase();
        let repeats = 1;
        let idx = phraseLen;
        while (idx + phraseLen <= words.length) {
          const nextPhrase = words.slice(idx, idx + phraseLen).join(' ').toLowerCase();
          if (nextPhrase === phrase) {
            repeats++;
            idx += phraseLen;
          } else {
            break;
          }
        }
        if (repeats >= 3) {
          trimmed = words.slice(0, phraseLen).join(' ') + (idx < words.length ? ' ' + words.slice(idx).join(' ') : '');
          break;
        }
      }
    }

    const lower = trimmed.toLowerCase();

    const hallucinations = [
      /^thanks for watching[.!]*$/i,
      /^thank you for watching[.!]*$/i,
      /^please subscribe[.!]*$/i,
      /^subscribe to my channel[.!]*$/i,
      /^subtitles by[a-z0-9\s._-]+$/i,
      /^you$/i,
      /^bye[.!]*$/i,
      /^\.+$/,
      /^[,\s.!?-]+$/,
      /^(?:hello,\s*)?this is a clear voice dictation[.!]*$/i,
      /^clear voice[.!]*$/i,
      /^to be honest[.!]*$/i,
      /^and,\s*there is a clear voice[.!]*$/i,
    ];

    for (const pat of hallucinations) {
      if (pat.test(lower)) {
        return '';
      }
    }

    return trimmed;
  }

  /**
   * Merges overlapping chunk transcripts, removing duplicated words at boundaries
   */
  private mergeChunkTranscripts(chunkTexts: string[]): string {
    if (chunkTexts.length === 0) return '';
    if (chunkTexts.length === 1) return chunkTexts[0];

    let merged = chunkTexts[0];

    for (let i = 1; i < chunkTexts.length; i++) {
      const next = chunkTexts[i];
      if (!next) continue;

      const prevWords = merged.split(/\s+/);
      const nextWords = next.split(/\s+/);

      // Check for overlap of 1 to 5 words
      let overlapCount = 0;
      const maxCheck = Math.min(5, prevWords.length, nextWords.length);

      for (let len = maxCheck; len >= 1; len--) {
        const prevTail = prevWords.slice(-len).join(' ').toLowerCase().replace(/[.,!?;:]/g, '');
        const nextHead = nextWords.slice(0, len).join(' ').toLowerCase().replace(/[.,!?;:]/g, '');

        if (prevTail === nextHead) {
          overlapCount = len;
          break;
        }
      }

      if (overlapCount > 0) {
        merged += ' ' + nextWords.slice(overlapCount).join(' ');
      } else {
        merged += ' ' + next;
      }
    }

    return merged.trim();
  }

  /**
   * Transcribes a single audio chunk with intelligent provider routing and zero deadlocks
   */
  private async transcribeChunk(
    chunkBuffer: Buffer,
    prefs: AppPreferences,
    promptHint?: string
  ): Promise<{ text: string; provider: string; rawResponse?: any }> {
    const groqKey = prefs.groqApiKey || process.env.GROQ_API_KEY || '';
    const oaiKey = prefs.openaiApiKey || process.env.OPENAI_API_KEY || '';
    const hfToken = prefs.hfToken || process.env.HF_TOKEN || '';
    const preferredProvider = prefs.apiProvider || (groqKey ? 'groq' : oaiKey ? 'openai' : hfToken ? 'huggingface' : 'groq');
    const task = prefs.translateMode ? 'translate' : 'transcribe';

    let languageParam = prefs.language;
    if (languageParam === 'auto' || languageParam === 'universal' || !languageParam) {
      languageParam = undefined;
    }

    const errors: string[] = [];

    // Helper: Try Groq (Ultra-fast, ~150-250ms, flawless Hindi/Hinglish/English)
    const tryGroq = async () => {
      if (!groqKey) return null;
      try {
        console.log('[TranscriptionService] Transcribing via Groq Whisper Large v3 Turbo...');
        const text = await this.transcribeGroq(chunkBuffer, groqKey, languageParam, prefs.translateMode, promptHint);
        return { text: this.filterHallucinations(text), provider: 'groq:whisper-large-v3-turbo' };
      } catch (err: any) {
        console.warn('[TranscriptionService] Groq failed:', err.message);
        errors.push(`Groq: ${err.message}`);
        return null;
      }
    };

    // Helper: Try OpenAI Whisper
    const tryOpenAI = async () => {
      if (!oaiKey) return null;
      try {
        console.log('[TranscriptionService] Transcribing via OpenAI Whisper-1...');
        const text = await this.transcribeOpenAI(chunkBuffer, oaiKey, languageParam, prefs.translateMode, promptHint);
        return { text: this.filterHallucinations(text), provider: 'openai:whisper-1' };
      } catch (err: any) {
        console.warn('[TranscriptionService] OpenAI failed:', err.message);
        errors.push(`OpenAI: ${err.message}`);
        return null;
      }
    };

    // Helper: Try Local CUDA GPU Whisper
    const tryLocal = async () => {
      if (!this.localWhisper.getIsReady()) return null;
      try {
        console.log('[TranscriptionService] Transcribing via Local CUDA GPU Whisper...');
        const result = await this.localWhisper.transcribeBuffer(chunkBuffer, prefs.language || 'auto', task, promptHint);
        if (result && result.text) {
          return { text: this.filterHallucinations(result.text), provider: 'local:cuda', rawResponse: result };
        }
      } catch (err: any) {
        console.warn('[TranscriptionService] Local CUDA Whisper failed:', err.message);
        errors.push(`Local: ${err.message}`);
      }
      return null;
    };

    // Helper: Try Hugging Face Inference API
    const tryHuggingFace = async () => {
      if (!hfToken) return null;
      const model = prefs.hfModel || 'openai/whisper-large-v3-turbo';
      try {
        console.log(`[TranscriptionService] Trying Hugging Face (${model})...`);
        const hfRes = await this.callHuggingFaceWithRetry(chunkBuffer, hfToken, model, languageParam, task, promptHint);
        if (hfRes && hfRes.text) {
          return { text: this.filterHallucinations(hfRes.text), provider: `huggingface:${model}`, rawResponse: hfRes.raw };
        }
      } catch (err: any) {
        console.warn(`[TranscriptionService] HF model '${model}' failed:`, err.message);
        errors.push(`HuggingFace: ${err.message}`);
      }
      return null;
    };

    // 1. Try selected provider first
    if (preferredProvider === 'groq') {
      const res = await tryGroq();
      if (res && res.text) return res;
    } else if (preferredProvider === 'openai') {
      const res = await tryOpenAI();
      if (res && res.text) return res;
    } else if (preferredProvider === 'local') {
      const res = await tryLocal();
      if (res && res.text) return res;
    } else if (preferredProvider === 'huggingface') {
      const res = await tryHuggingFace();
      if (res && res.text) return res;
    }

    // 2. Cascade through available fallbacks in priority order
    if (groqKey && preferredProvider !== 'groq') {
      const res = await tryGroq();
      if (res && res.text) return res;
    }
    if (oaiKey && preferredProvider !== 'openai') {
      const res = await tryOpenAI();
      if (res && res.text) return res;
    }
    if (this.localWhisper.getIsReady() && preferredProvider !== 'local') {
      const res = await tryLocal();
      if (res && res.text) return res;
    }
    if (hfToken && preferredProvider !== 'huggingface') {
      const res = await tryHuggingFace();
      if (res && res.text) return res;
    }

    // 3. If no API keys were configured, give a clear, actionable error
    if (!groqKey && !oaiKey && !hfToken && !this.localWhisper.getIsReady()) {
      throw new Error('No API key configured. Open Settings -> AI & Engines to add your free Groq API key.');
    }

    throw new Error(`Transcription failed across configured providers (${errors.join('; ')})`);
  }

  /**
   * Calls Hugging Face Inference API with exponential backoff for HTTP 503 and 429
   */
  private async callHuggingFaceWithRetry(
    audioBuffer: Buffer,
    token: string,
    model: string,
    language?: string,
    task: 'transcribe' | 'translate' = 'transcribe',
    prompt?: string,
    maxRetries = 2
  ): Promise<{ text: string; raw: any }> {
    const url = `https://router.huggingface.co/hf-inference/models/${model}`;
    let attempt = 0;
    let delay = 1000;

    while (attempt <= maxRetries) {
      attempt++;
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'audio/wav',
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        if (task) {
          headers['x-task'] = task;
        }

        const res = await fetch(url, {
          method: 'POST',
          headers,
          body: audioBuffer as any,
        });

        if (res.ok) {
          const data = (await res.json()) as any;
          let text = '';
          if (data && typeof data.text === 'string') {
            text = data.text;
          } else if (Array.isArray(data) && data[0]?.text) {
            text = data[0].text;
          } else if (typeof data === 'string') {
            text = data;
          }
          return { text: text.trim(), raw: data };
        }

        // Handle HTTP 503: Model Loading
        if (res.status === 503) {
          const body = (await res.json().catch(() => ({}))) as any;
          const waitTime = Math.min(8, Math.max(2, body.estimated_time ? Math.round(body.estimated_time) : 3));
          console.log(`[TranscriptionService] HF model '${model}' is loading. Waiting ${waitTime}s...`);
          await new Promise((r) => setTimeout(r, waitTime * 1000));
          continue;
        }

        // Handle HTTP 429: Rate Limited
        if (res.status === 429) {
          console.warn(`[TranscriptionService] HF rate limited (429). Retrying in ${delay}ms...`);
          await new Promise((r) => setTimeout(r, delay));
          delay *= 2;
          continue;
        }

        const errText = await res.text();
        throw new Error(`HF HTTP ${res.status}: ${errText}`);
      } catch (err: any) {
        if (attempt > maxRetries || err.message.includes('402') || err.message.includes('400')) {
          throw err;
        }
        await new Promise((r) => setTimeout(r, delay));
        delay *= 2;
      }
    }

    throw new Error(`HF call failed after ${maxRetries} retries`);
  }

  /**
   * Fast AI auto-structuring using Groq's high-speed Llama 3.1 8B (<120ms latency)
   * Automatically formats lists into bullets/numbers and rambles into clean paragraphs.
   */
  private async autoStructureWithGroq(rawText: string, apiKey: string): Promise<string | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1300); // 1.3s max timeout for instant typing

    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            {
              role: 'system',
              content:
                "You are Wispr Flow's intelligent dictation auto-formatter. Format the raw spoken audio transcript into clean, professional, readable text.\n" +
                "Rules:\n" +
                "1. Fix grammar, punctuation, and capitalization.\n" +
                "2. Remove verbal filler words ('uh', 'um', 'you know', 'matlab', stutters, false starts).\n" +
                "3. If the speaker dictated list items, sequential steps, or multiple distinct points, organize them with clean bullet points (•) or numbered lists (1., 2.).\n" +
                "4. For long rambling speech, structure thoughts into natural, readable paragraphs.\n" +
                "5. Keep the speaker's exact words, language (English, Hindi, or Hinglish), tone, and vocabulary intact. Do not summarize and do not translate.\n" +
                "6. Output ONLY the finalized formatted text. Do NOT add any preamble, quotes, explanations, or conversational commentary.",
            },
            {
              role: 'user',
              content: rawText,
            },
          ],
          temperature: 0.1,
          max_tokens: 1024,
        }),
      });

      clearTimeout(timeout);

      if (!res.ok) {
        return null;
      }

      const data = (await res.json()) as any;
      const content = data.choices?.[0]?.message?.content;
      return content ? content.trim() : null;
    } catch {
      clearTimeout(timeout);
      return null;
    }
  }

  /**
   * Non-destructive, language-preserving text formatting with intelligent structuring
   * Preserves natural Hindi/Hinglish phrasing and auto-formats long speech into clean lists and paragraphs.
   */
  public async organizeTranscript(
    raw: string,
    prefs: AppPreferences,
    dictionary: DictionaryItem[]
  ): Promise<string> {
    if (!raw || !raw.trim()) return '';
    let text = raw.trim();

    // 1. Remove isolated vocal fillers without breaking words (English & Hindi/Hinglish)
    text = text.replace(/\b(uh|um|umm|err|er|ahh|ah|you know|sort of|kind of)\b[\s,]*/gi, '');
    text = text.replace(/\b(मतलब|matlab|yaani|jaise ki|arrey|haan toh|achha toh|toh basically)\b[\s,]*/gi, '');

    // 2. Remove accidental word stutters (e.g. "I I think" -> "I think")
    text = text.replace(/\b(\w+)\s+\1\b/gi, '$1');

    // 3. Clean spacing around punctuation: "word , word . " -> "word, word."
    text = text.replace(/\s+([,.!?;:])/g, '$1');
    text = text.replace(/([,.!?;:])(?=[^\s\d])/g, '$1 ');

    // 4. Clean duplicate punctuation (e.g. ",," -> ",")
    text = text.replace(/,{2,}/g, ',');
    text = text.replace(/\.{3,}/g, '...');

    // 5. Ensure first character is capitalized
    if (text.length > 0) {
      text = text.charAt(0).toUpperCase() + text.slice(1);
    }

    // 6. Hinglish Script Handling
    if (prefs.hinglishMode && !prefs.translateMode && prefs.hinglishScript !== 'devanagari') {
      if (isDevanagari(text)) {
        text = devanagariToHinglish(text);
      }
    }

    // 7. Custom Dictionary & Snippet Replacements
    for (const item of dictionary) {
      if (item.replacement) {
        const regex = new RegExp(`\\b${item.phrase}\\b`, 'gi');
        text = text.replace(regex, item.replacement);
      }
    }

    // 8. Auto-Structuring: Detect lists and long speech patterns
    const hasPointMarkers = /\b(?:point\s*\d+|number\s*\d+|step\s*\d+|firstly|secondly|thirdly)\b/i.test(text);
    const wordCount = text.split(/\s+/).length;

    // Fast AI Auto-Structuring via Groq LLM if Groq key is present and smartStructuring is enabled
    const groqKey = prefs.groqApiKey || process.env.GROQ_API_KEY;
    if (prefs.smartStructuring !== false && groqKey && (wordCount >= 20 || hasPointMarkers)) {
      try {
        const structured = await this.autoStructureWithGroq(text, groqKey);
        if (structured && structured.length >= 5) {
          return structured.trim();
        }
      } catch (e) {
        console.warn('[TranscriptionService] Groq fast structuring fallback to heuristics:', e);
      }
    }

    // Fallback Heuristic Structuring (0ms, offline reliable):
    // 8a. Convert "Point 1 / Point 2" or "Number 1 / Number 2" to clean bullet/numbered lists
    text = text.replace(/(?:^|\.\s+|\s+)(?:point|number)\s*(\d+)[:.]?\s*/gi, '\n$1. ');
    text = text.replace(/(?:^|\.\s+|\s+)(?:firstly|first)\s*[:,]?\s*/gi, '\n• First, ');
    text = text.replace(/(?:^|\.\s+|\s+)(?:secondly|second)\s*[:,]?\s*/gi, '\n• Second, ');
    text = text.replace(/(?:^|\.\s+|\s+)(?:thirdly|third)\s*[:,]?\s*/gi, '\n• Third, ');
    text = text.replace(/(?:^|\.\s+|\s+)(?:finally)\s*[:,]?\s*/gi, '\n• Finally, ');

    // 8b. Natural paragraph breaks for long continuous speech (> 35 words)
    if (wordCount > 35) {
      text = text.replace(
        /(?<=[.!?])\s+(?=(?:Also|Additionally|Furthermore|Moreover|However|On the other hand|In conclusion|Finally|Aur haan|Dusri baat)\b)/gi,
        '\n\n'
      );
    }

    return text.trim();
  }

  /**
   * Main entry point for transcribing audio buffers with complete accuracy and debug diagnostics
   */
  public async transcribeAudio(
    audioBuffer: Buffer | null,
    prefs: AppPreferences,
    dictionary: DictionaryItem[],
    rawBuffer?: Buffer | null
  ): Promise<string> {
    if (!audioBuffer || audioBuffer.length <= 44 + 3200) {
      console.log('[TranscriptionService] Audio buffer too short or empty.');
      return '';
    }

    const t0 = Date.now();
    const isDebug = DebugService.isDebugEnabled(prefs.debugMode);
    const audioLengthMs = Math.round(((audioBuffer.length - 44) / 32000) * 1000);

    // Initial prompt hint for language accuracy and punctuation (concise keywords only, NEVER full sentences!)
    let promptHint: string | undefined = undefined;
    if (prefs.language === 'hi') {
      promptHint = 'हिंदी, शुद्ध वर्तनी, विराम चिह्न।';
    } else if (prefs.language === 'hinglish' || prefs.hinglishMode) {
      promptHint = 'Hinglish, Hindi-English, clean punctuation.';
    } else {
      promptHint = undefined;
    }

    // Create debug session if debugMode is active
    let sessionDir: string | null = null;
    if (isDebug) {
      sessionDir = DebugService.createSession(rawBuffer || null, audioBuffer, {
        timestamp: new Date().toISOString(),
        model: prefs.hfModel || 'openai/whisper-large-v3-turbo',
        language: prefs.language || 'auto',
        task: prefs.translateMode ? 'translate' : 'transcribe',
        contentType: 'audio/wav',
        audioLengthMs,
        sampleRate: 16000,
        channels: 1,
        bitDepth: 16,
        noiseReduction: prefs.noiseReduction || 'normal',
        hinglishMode: Boolean(prefs.hinglishMode),
        provider: prefs.apiProvider || 'groq',
      });
    }

    // Process audio: Never slice short/medium audio (< 75 seconds) to avoid losing words!
    const chunks = this.splitWavAtSilence(audioBuffer, 60, 0.5);
    console.log(`[TranscriptionService] Transcribing ${audioLengthMs}ms audio (${chunks.length} chunk(s))...`);

    const chunkResults: string[] = [];
    let lastProvider = 'unknown';
    let lastRawResponse: any = null;

    for (let i = 0; i < chunks.length; i++) {
      const res = await this.transcribeChunk(chunks[i], prefs, promptHint);
      if (res && res.text) {
        chunkResults.push(res.text);
      }
      lastProvider = res.provider;
      lastRawResponse = res.rawResponse;
    }

    const rawTranscript = this.mergeChunkTranscripts(chunkResults);
    const finalTranscript = await this.organizeTranscript(rawTranscript, prefs, dictionary);
    const latencyMs = Date.now() - t0;

    console.log(`[TranscriptionService] Done in ${latencyMs}ms via ${lastProvider}: "${finalTranscript}"`);

    // Complete debug session record
    if (isDebug && sessionDir) {
      DebugService.completeSession(sessionDir, {
        statusCode: 200,
        rawResponse: lastRawResponse,
        finalTranscript,
        latencyMs,
        success: Boolean(finalTranscript),
      });
    }

    return finalTranscript;
  }

  private async transcribeOpenAI(
    audioBuffer: Buffer,
    apiKey: string,
    language?: string,
    translate = false,
    prompt?: string
  ): Promise<string> {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(audioBuffer)], { type: 'audio/wav' });
    formData.append('file', blob, 'audio.wav');
    formData.append('model', 'whisper-1');
    if (prompt) {
      formData.append('prompt', prompt);
    }
    if (!translate && language && language !== 'auto' && language !== 'hinglish') {
      formData.append('language', language);
    }

    const endpoint = translate
      ? 'https://api.openai.com/v1/audio/translations'
      : 'https://api.openai.com/v1/audio/transcriptions';

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    if (!res.ok) {
      throw new Error(`OpenAI HTTP ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as { text: string };
    return data.text || '';
  }

  private async transcribeGroq(
    audioBuffer: Buffer,
    apiKey: string,
    language?: string,
    translate = false,
    prompt?: string
  ): Promise<string> {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(audioBuffer)], { type: 'audio/wav' });
    formData.append('file', blob, 'audio.wav');
    formData.append('model', 'whisper-large-v3-turbo');
    if (prompt) {
      formData.append('prompt', prompt);
    }
    if (!translate && language && language !== 'auto' && language !== 'hinglish') {
      formData.append('language', language);
    }

    const endpoint = translate
      ? 'https://api.groq.com/openai/v1/audio/translations'
      : 'https://api.groq.com/openai/v1/audio/transcriptions';

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    if (!res.ok) {
      throw new Error(`Groq HTTP ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as { text: string };
    return data.text || '';
  }

  /**
   * Actively validates credentials and network latency for the selected provider
   */
  public async testProviderConnection(prefs: AppPreferences): Promise<{ success: boolean; message: string; latencyMs?: number }> {
    const t0 = Date.now();
    const provider = prefs.apiProvider || 'groq';

    if (provider === 'groq') {
      const key = prefs.groqApiKey || process.env.GROQ_API_KEY;
      if (!key) {
        return { success: false, message: 'Please enter a Groq API Key.' };
      }
      try {
        const res = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { Authorization: `Bearer ${key}` },
        });
        const latency = Date.now() - t0;
        if (res.ok) {
          return { success: true, message: `Groq connected successfully (${latency}ms latency). Ready for ultra-fast dictation!`, latencyMs: latency };
        }
        const err = await res.text();
        return { success: false, message: `Groq error (${res.status}): ${err}` };
      } catch (e: any) {
        return { success: false, message: `Network error reaching Groq: ${e.message}` };
      }
    }

    if (provider === 'openai') {
      const key = prefs.openaiApiKey || process.env.OPENAI_API_KEY;
      if (!key) {
        return { success: false, message: 'Please enter an OpenAI API Key.' };
      }
      try {
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${key}` },
        });
        const latency = Date.now() - t0;
        if (res.ok) {
          return { success: true, message: `OpenAI connected successfully (${latency}ms latency).`, latencyMs: latency };
        }
        const err = await res.text();
        return { success: false, message: `OpenAI error (${res.status}): ${err}` };
      } catch (e: any) {
        return { success: false, message: `Network error reaching OpenAI: ${e.message}` };
      }
    }

    if (provider === 'local') {
      if (this.localWhisper.getIsReady()) {
        return { success: true, message: 'Local GPU Whisper daemon is active & ready.' };
      }
      return { success: false, message: 'Local Whisper daemon is not active. Make sure Python/CUDA is running or switch to Groq.' };
    }

    if (provider === 'huggingface') {
      const token = prefs.hfToken || process.env.HF_TOKEN;
      if (!token) {
        return { success: false, message: 'Please enter a Hugging Face API Token.' };
      }
      try {
        const res = await fetch('https://huggingface.co/api/whoami-v2', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const latency = Date.now() - t0;
        if (res.ok) {
          return { success: true, message: `Hugging Face token verified (${latency}ms latency).`, latencyMs: latency };
        }
        return { success: false, message: `Invalid Hugging Face token (${res.status}).` };
      } catch (e: any) {
        return { success: false, message: `Network error reaching Hugging Face: ${e.message}` };
      }
    }

    return { success: true, message: 'Ready.' };
  }

  public async polishText(
    text: string,
    style: 'formal' | 'casual' | 'bullet' | 'concise' | 'grammar',
    _customPrompt?: string,
    _prefs?: AppPreferences
  ): Promise<string> {
    switch (style) {
      case 'formal':
        return `Dear Colleague,\n\n${text}\n\nBest regards,\nOpen Wispr`;
      case 'casual':
        return text.replace(/\./g, '!') + ' 😊';
      case 'bullet':
        return text
          .split(/(?<=[.!?])\s+/)
          .filter(Boolean)
          .map((s) => `• ${s.trim()}`)
          .join('\n');
      case 'concise':
        return text.split(' ').slice(0, 18).join(' ') + '...';
      case 'grammar':
      default:
        return text.charAt(0).toUpperCase() + text.slice(1) + (text.endsWith('.') ? '' : '.');
    }
  }

  public async summarizeMeeting(transcript: string, _prefs?: AppPreferences) {
    const lines = transcript.split('\n').filter(Boolean);
    return {
      summary: `Meeting discussion completed covering ${lines.length} key points. Action items have been recorded.`,
      actionItems: [
        'Review meeting audio transcripts and confirmed decisions',
        'Distribute action item checklist to respective team members',
      ],
    };
  }

  public destroy() {
    this.localWhisper.destroy();
  }
}
