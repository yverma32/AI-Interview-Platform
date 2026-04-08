import { useState, useCallback, useRef, useEffect } from 'react';

interface UseSpeechRecognitionOptions {
  silenceTimeoutMs?: number;
  onSilenceTimeout?: () => void;
}

interface UseSpeechRecognitionReturn {
  transcript: string;
  interimTranscript: string;
  isListening: boolean;
  isSupported: boolean;
  isSpeaking: boolean;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {}
): UseSpeechRecognitionReturn {
  const { silenceTimeoutMs = 3000, onSilenceTimeout } = options;

  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const wantListeningRef = useRef(false);
  const accumulatedTranscriptRef = useRef('');
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const hasSpokenRef = useRef(false);
  const onSilenceTimeoutRef = useRef(onSilenceTimeout);
  // Generation counter — prevents stale onend handlers from restarting
  const genRef = useRef(0);
  // Restart counter — limits how many times onend can auto-restart per generation
  const restartCountRef = useRef(0);
  // Track last error so onend can treat no-speech differently
  const lastErrorRef = useRef<string | null>(null);

  useEffect(() => {
    onSilenceTimeoutRef.current = onSilenceTimeout;
  }, [onSilenceTimeout]);

  const SpeechRecognitionAPI =
    typeof window !== 'undefined'
      ? (window.SpeechRecognition ?? window.webkitSpeechRecognition)
      : undefined;
  const isSupported = !!SpeechRecognitionAPI;

  const resetSilenceTimer = useCallback(() => {
    clearTimeout(silenceTimerRef.current);
    if (!wantListeningRef.current || !hasSpokenRef.current) return;
    silenceTimerRef.current = setTimeout(() => {
      if (wantListeningRef.current && hasSpokenRef.current) {
        onSilenceTimeoutRef.current?.();
      }
    }, silenceTimeoutMs);
  }, [silenceTimeoutMs]);

  const buildRecognition = useCallback(
    (generation: number) => {
      if (!SpeechRecognitionAPI) return null;

      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;

      // Track which result indices we've already folded into the accumulated transcript
      // so we never double-count finalized results within a continuous session.
      let processedUpTo = 0;

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        // Stale instance — ignore
        if (genRef.current !== generation) return;

        let newFinalText = '';
        let interimText = '';

        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            // Only accumulate results we haven't processed yet
            if (i >= processedUpTo) {
              newFinalText += result[0].transcript + ' ';
              processedUpTo = i + 1;
            }
          } else {
            interimText += result[0].transcript;
          }
        }

        // Update accumulated ref with only new final text
        if (newFinalText.trim()) {
          accumulatedTranscriptRef.current = (
            accumulatedTranscriptRef.current +
            ' ' +
            newFinalText
          ).trim();
        }

        setTranscript(accumulatedTranscriptRef.current);
        setInterimTranscript(interimText);

        if (newFinalText.trim() || interimText.trim()) {
          hasSpokenRef.current = true;
          setIsSpeaking(true);
          resetSilenceTimer();
        }

        if (!interimText.trim() && newFinalText.trim()) {
          setIsSpeaking(false);
          resetSilenceTimer();
        }
      };

      recognition.onspeechend = () => {
        if (genRef.current !== generation) return;
        setIsSpeaking(false);
        resetSilenceTimer();
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (genRef.current !== generation) return;
        console.warn('Speech recognition error:', event.error);
        lastErrorRef.current = event.error;
        if (event.error === 'aborted' || event.error === 'no-speech') {
          return;
        }
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          wantListeningRef.current = false;
          setIsListening(false);
          setIsSpeaking(false);
        }
      };

      recognition.onend = () => {
        // Stale generation — do nothing (prevents double-start race)
        if (genRef.current !== generation) return;

        if (wantListeningRef.current) {
          const wasNoSpeech = lastErrorRef.current === 'no-speech';
          lastErrorRef.current = null;

          // no-speech is normal (user just hasn't spoken yet) — always restart,
          // don't count toward the real-error restart limit.
          if (!wasNoSpeech) {
            restartCountRef.current += 1;
            if (restartCountRef.current > 8) {
              console.warn('[STT] Too many auto-restarts (gen=' + generation + '), stopping');
              wantListeningRef.current = false;
              setIsListening(false);
              setIsSpeaking(false);
              return;
            }
          }

          // Delay: short for no-speech (keep-alive), increasing for real errors
          const delay = wasNoSpeech ? 100 : Math.min(restartCountRef.current * 300, 2000);
          if (!wasNoSpeech) {
            console.log('[STT] Auto-restart #' + restartCountRef.current + ' in ' + delay + 'ms');
          }
          setTimeout(() => {
            if (genRef.current !== generation || !wantListeningRef.current) return;
            try {
              const next = buildRecognition(generation);
              if (next) {
                recognitionRef.current = next;
                next.start();
                return;
              }
            } catch (err) {
              console.warn('[STT] Restart failed:', err);
            }
            setIsListening(false);
            setIsSpeaking(false);
          }, delay);
          return;
        }
        setIsListening(false);
        setIsSpeaking(false);
      };

      return recognition;
    },
    [SpeechRecognitionAPI, resetSilenceTimer]
  );

  const startListening = useCallback(() => {
    if (!SpeechRecognitionAPI) return;

    // Cancel any lingering TTS that might block microphone access
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    // Bump generation so any in-flight onend from old instance is ignored
    const newGen = genRef.current + 1;
    genRef.current = newGen;
    restartCountRef.current = 0;
    lastErrorRef.current = null;

    // Kill old instance safely
    wantListeningRef.current = false;
    const oldRecognition = recognitionRef.current;
    recognitionRef.current = null;
    clearTimeout(silenceTimerRef.current);

    accumulatedTranscriptRef.current = '';
    hasSpokenRef.current = false;

    // Abort old instance asynchronously (don't block new start)
    if (oldRecognition) {
      try { oldRecognition.abort(); } catch { /* ignore */ }
    }

    // Build and start new recognition
    const doStart = () => {
      if (genRef.current !== newGen) return; // superseded
      const recognition = buildRecognition(newGen);
      if (!recognition) return;

      recognitionRef.current = recognition;
      wantListeningRef.current = true;

      try {
        recognition.start();
        setIsListening(true);
        setIsSpeaking(false);
        console.log('[STT] Recognition started, gen=', newGen);
      } catch (err) {
        console.error('[STT] Failed to start recognition:', err);
        wantListeningRef.current = false;
        setIsListening(false);
        // Retry once after a short delay
        setTimeout(() => {
          if (genRef.current !== newGen) return;
          const retry = buildRecognition(newGen);
          if (!retry) return;
          recognitionRef.current = retry;
          wantListeningRef.current = true;
          try {
            retry.start();
            setIsListening(true);
            console.log('[STT] Recognition started on retry, gen=', newGen);
          } catch {
            console.error('[STT] Retry also failed');
            wantListeningRef.current = false;
            setIsListening(false);
          }
        }, 150);
      }
    };

    // If there was an old instance, give the browser a moment to release the mic
    if (oldRecognition) {
      setTimeout(doStart, 50);
    } else {
      doStart();
    }
  }, [SpeechRecognitionAPI, buildRecognition]);

  const stopListening = useCallback(() => {
    wantListeningRef.current = false;
    clearTimeout(silenceTimerRef.current);
    // Bump generation to ignore any pending onend
    genRef.current += 1;
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
    setIsListening(false);
    setIsSpeaking(false);

    setInterimTranscript((currentInterim) => {
      if (currentInterim.trim()) {
        accumulatedTranscriptRef.current = (
          accumulatedTranscriptRef.current +
          ' ' +
          currentInterim
        ).trim();
        setTranscript(accumulatedTranscriptRef.current);
      }
      return '';
    });
  }, []);

  const resetTranscript = useCallback(() => {
    accumulatedTranscriptRef.current = '';
    hasSpokenRef.current = false;
    setTranscript('');
    setInterimTranscript('');
  }, []);

  useEffect(() => {
    return () => {
      wantListeningRef.current = false;
      genRef.current += 1;
      clearTimeout(silenceTimerRef.current);
      try {
        recognitionRef.current?.abort();
      } catch {
        /* ignore */
      }
    };
  }, []);

  return {
    transcript,
    interimTranscript,
    isListening,
    isSpeaking,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  };
}
