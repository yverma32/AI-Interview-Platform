import { useState, useCallback, useRef, useEffect } from 'react';

interface UseSpeechSynthesisReturn {
  speak: (text: string) => Promise<void>;
  stop: () => void;
  isSpeaking: boolean;
  isSupported: boolean;
}

export function useSpeechSynthesis(): UseSpeechSynthesisReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const isMountedRef = useRef(true);
  const keepAliveRef = useRef<ReturnType<typeof setInterval>>();
  const safetyTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const cachedVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  useEffect(() => {
    isMountedRef.current = true;

    if (!isSupported) return;

    // Pre-cache voice so speak() doesn't waste time searching
    const cacheVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length === 0) return;
      cachedVoiceRef.current =
        voices.find((v) => v.name.includes('Google') && v.lang.startsWith('en')) ||
        voices.find((v) => v.lang.startsWith('en-') && v.name.includes('Male')) ||
        voices.find((v) => v.lang.startsWith('en')) ||
        null;
    };
    cacheVoice();
    // Chrome fires voiceschanged after lazy load
    window.speechSynthesis.addEventListener('voiceschanged', cacheVoice);

    return () => {
      isMountedRef.current = false;
      clearInterval(keepAliveRef.current);
      clearTimeout(safetyTimeoutRef.current);
      window.speechSynthesis.removeEventListener('voiceschanged', cacheVoice);
      window.speechSynthesis.cancel();
    };
  }, [isSupported]);

  const speak = useCallback(
    (text: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (!isSupported) {
          reject(new Error('Speech synthesis not supported'));
          return;
        }

        // Clean up any previous keep-alive
        clearInterval(keepAliveRef.current);
        clearTimeout(safetyTimeoutRef.current);
        // Only cancel if actually speaking — avoids unnecessary latency
        if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
          window.speechSynthesis.cancel();
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.05;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        // Use pre-cached voice (falls back to default if none found)
        if (cachedVoiceRef.current) {
          utterance.voice = cachedVoiceRef.current;
        }

        let settled = false;
        const settle = (fn: () => void) => {
          if (settled) return;
          settled = true;
          clearInterval(keepAliveRef.current);
          clearTimeout(safetyTimeoutRef.current);
          fn();
        };

        utterance.onstart = () => {
          if (isMountedRef.current) setIsSpeaking(true);
        };
        utterance.onend = () => {
          settle(() => {
            if (isMountedRef.current) setIsSpeaking(false);
            resolve();
          });
        };
        utterance.onerror = (event) => {
          settle(() => {
            if (isMountedRef.current) setIsSpeaking(false);
            if (event.error === 'interrupted' || event.error === 'canceled') {
              resolve();
            } else {
              reject(event);
            }
          });
        };

        window.speechSynthesis.speak(utterance);

        // Chrome bug workaround: speechSynthesis stops firing events on long
        // utterances. Periodically pause/resume to keep it alive.
        keepAliveRef.current = setInterval(() => {
          if (window.speechSynthesis.speaking) {
            window.speechSynthesis.pause();
            window.speechSynthesis.resume();
          }
        }, 3000);

        // Safety timeout — if TTS hasn't ended in 30s, force-resolve so the
        // interview doesn't hang.  Estimate ~150 WPM speaking rate.
        const wordCount = text.split(/\s+/).length;
        const estimatedMs = Math.max((wordCount / 150) * 60 * 1000 + 3000, 8000);
        const maxMs = Math.min(estimatedMs, 30000);

        safetyTimeoutRef.current = setTimeout(() => {
          if (!settled) {
            console.warn('[TTS] Safety timeout — forcing resolve');
            window.speechSynthesis.cancel();
            settle(() => {
              if (isMountedRef.current) setIsSpeaking(false);
              resolve();
            });
          }
        }, maxMs);
      });
    },
    [isSupported]
  );

  const stop = useCallback(() => {
    clearInterval(keepAliveRef.current);
    clearTimeout(safetyTimeoutRef.current);
    if (isSupported) window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [isSupported]);

  return { speak, stop, isSpeaking, isSupported };
}
