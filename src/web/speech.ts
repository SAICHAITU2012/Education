import type { Lang } from '../core/types.js';

/**
 * Browser speech layer. Speech recognition and synthesis never leave the
 * device here; the production path can swap in Sarvam/IndicConformer behind
 * the same two functions. Typing is always available as an equal path.
 */

interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
  length: number;
}

interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: { resultIndex: number; results: { length: number; [index: number]: RecognitionResult } }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
}

type RecognitionCtor = new () => RecognitionLike;

function recognitionCtor(): RecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function speechRecognitionSupported(): boolean {
  return recognitionCtor() !== null;
}

export function speechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export const bcp47: Record<Lang, string> = {
  hi: 'hi-IN',
  en: 'en-IN',
  kn: 'kn-IN',
  ta: 'ta-IN',
  te: 'te-IN',
  ml: 'ml-IN',
};

export interface DictationHandlers {
  onInterim(text: string): void;
  onFinal(text: string): void;
  onError(message: string): void;
}

export interface Dictation {
  stop(): void;
  abort(): void;
}

/**
 * Start a single dictation. The recogniser auto-stops on silence; `stop()` is
 * for the button. `onFinal` fires exactly once with final + last interim text.
 */
export function startDictation(lang: Lang, handlers: DictationHandlers): Dictation | null {
  const Ctor = recognitionCtor();
  if (!Ctor) return null;

  const recognition = new Ctor();
  recognition.lang = bcp47[lang] ?? 'hi-IN';
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  let finalText = '';
  let interimText = '';
  let ended = false;
  let aborted = false;

  const finish = () => {
    if (ended) return;
    ended = true;
    handlers.onFinal(`${finalText} ${interimText}`.replace(/\s+/g, ' ').trim());
  };

  recognition.onresult = (event) => {
    interimText = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (!result) continue;
      const transcript = result[0]?.transcript ?? '';
      if (result.isFinal) finalText += transcript;
      else interimText += transcript;
    }
    handlers.onInterim(`${finalText} ${interimText}`.replace(/\s+/g, ' ').trim());
  };
  recognition.onerror = (event) => {
    const code = event.error ?? 'speech_error';
    if (code === 'aborted') return;
    handlers.onError(code);
    if (code === 'no-speech' || code === 'audio-capture') finish();
  };
  recognition.onend = () => {
    if (!aborted) finish();
  };

  try {
    recognition.start();
  } catch {
    handlers.onError('could_not_start');
    return null;
  }

  return {
    stop: () => {
      try {
        recognition.stop();
      } catch {
        finish();
      }
    },
    abort: () => {
      aborted = true;
      try {
        recognition.abort();
      } catch {
        // ignore
      }
    },
  };
}

let activeUtterance: SpeechSynthesisUtterance | null = null;

export function speak(text: string, lang: Lang, options: { rate?: number; pitch?: number } = {}): void {
  if (!speechSynthesisSupported() || !text.trim()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = bcp47[lang] ?? 'hi-IN';
  utterance.rate = options.rate ?? 0.92;
  utterance.pitch = options.pitch ?? 1.18;
  const voices = synth.getVoices();
  const match =
    voices.find((v) => v.lang === utterance.lang) ??
    voices.find((v) => v.lang.startsWith(utterance.lang.split('-')[0] ?? 'hi'));
  if (match) utterance.voice = match;
  activeUtterance = utterance;
  utterance.onend = () => {
    if (activeUtterance === utterance) activeUtterance = null;
  };
  synth.speak(utterance);
}

/** Speak several lines in order (used by "play it back"). */
export function speakSequence(texts: string[], lang: Lang): void {
  if (!speechSynthesisSupported()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  for (const text of texts.filter((t) => t.trim())) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = bcp47[lang] ?? 'hi-IN';
    utterance.rate = 0.95;
    utterance.pitch = 1;
    const match = synth.getVoices().find((v) => v.lang === utterance.lang);
    if (match) utterance.voice = match;
    synth.speak(utterance);
  }
}

export function stopSpeaking(): void {
  if (!speechSynthesisSupported()) return;
  window.speechSynthesis.cancel();
  activeUtterance = null;
}
