import { useState, useCallback, useRef, useEffect } from 'react';

interface UseDeepgramRecognitionOptions {
  silenceTimeoutMs?: number;
  onSilenceTimeout?: () => void;
}

interface UseDeepgramRecognitionReturn {
  transcript: string;
  interimTranscript: string;
  isListening: boolean;
  isSupported: boolean;
  isSpeaking: boolean;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

/**
 * Real-time speech-to-text using Deepgram's WebSocket streaming API.
 * Same interface as `useSpeechRecognition` so it's a drop-in replacement.
 */
export function useDeepgramRecognition(
  deepgramKey: string | null,
  options: UseDeepgramRecognitionOptions = {}
): UseDeepgramRecognitionReturn {
  const { silenceTimeoutMs = 3000, onSilenceTimeout } = options;

  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const accumulatedRef = useRef('');
  const lastFinalTextRef = useRef('');
  const wantListeningRef = useRef(false);
  const hasSpokenRef = useRef(false);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const onSilenceTimeoutRef = useRef(onSilenceTimeout);

  const isSupported = !!deepgramKey;

  useEffect(() => {
    onSilenceTimeoutRef.current = onSilenceTimeout;
  }, [onSilenceTimeout]);

  const resetSilenceTimer = useCallback(() => {
    clearTimeout(silenceTimerRef.current);
    if (!wantListeningRef.current || !hasSpokenRef.current) return;
    silenceTimerRef.current = setTimeout(() => {
      if (wantListeningRef.current && hasSpokenRef.current) {
        onSilenceTimeoutRef.current?.();
      }
    }, silenceTimeoutMs);
  }, [silenceTimeoutMs]);

  const cleanup = useCallback(() => {
    clearTimeout(silenceTimerRef.current);

    if (mediaRecorderRef.current) {
      try { mediaRecorderRef.current.stop(); } catch { /* ignore */ }
      mediaRecorderRef.current = null;
    }

    if (wsRef.current) {
      try {
        // Send close message to Deepgram to finalize any pending audio
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'CloseStream' }));
        }
        wsRef.current.close();
      } catch { /* ignore */ }
      wsRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      wantListeningRef.current = false;
      cleanup();
    };
  }, [cleanup]);

  const startListening = useCallback(async () => {
    if (!deepgramKey) return;

    // Cancel any lingering TTS
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    // Clean up previous session
    cleanup();

    accumulatedRef.current = '';
    hasSpokenRef.current = false;
    wantListeningRef.current = true;
    setTranscript('');
    setInterimTranscript('');
    setIsListening(true);
    setIsSpeaking(false);

    try {
      // Get microphone stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });
      streamRef.current = stream;

      if (!wantListeningRef.current) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      // Connect to Deepgram's streaming WebSocket
      const params = new URLSearchParams({
        model: 'nova-2',
        language: 'en',
        smart_format: 'true',
        interim_results: 'true',
        utterance_end_ms: '1500',
        vad_events: 'true',
        punctuate: 'true',
      });

      const ws = new WebSocket(
        `wss://api.deepgram.com/v1/listen?${params.toString()}`,
        ['token', deepgramKey]
      );
      wsRef.current = ws;

      ws.onopen = () => {
        if (!wantListeningRef.current) {
          ws.close();
          return;
        }
        console.log('[Deepgram] WebSocket connected');

        // Start sending audio chunks
        // Pick a supported mimeType
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm')
            ? 'audio/webm'
            : 'audio/mp4';

        const recorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            ws.send(e.data);
          }
        };

        // Send audio in small chunks for low latency
        recorder.start(250);
      };

      ws.onmessage = (event) => {
        if (!wantListeningRef.current) return;

        try {
          const data = JSON.parse(event.data);

          // VAD speech started event
          if (data.type === 'SpeechStarted') {
            setIsSpeaking(true);
            hasSpokenRef.current = true;
            return;
          }

          // Utterance end event — good point for silence detection
          if (data.type === 'UtteranceEnd') {
            setIsSpeaking(false);
            resetSilenceTimer();
            return;
          }

          // Transcript result
          if (data.channel?.alternatives?.[0]) {
            const alt = data.channel.alternatives[0];
            const text = alt.transcript || '';

            if (data.is_final) {
              // Only accumulate if we have new, non-duplicate text.
              // Deepgram can send the same text twice: once as is_final
              // and again as speech_final — skip the duplicate.
              if (text && text !== lastFinalTextRef.current) {
                hasSpokenRef.current = true;
                accumulatedRef.current = (accumulatedRef.current + ' ' + text).trim();
                setTranscript(accumulatedRef.current);
                lastFinalTextRef.current = text;
              }
              setInterimTranscript('');

              if (data.speech_final) {
                // End-of-utterance — reset dedup tracker for next segment
                lastFinalTextRef.current = '';
                setIsSpeaking(false);
                resetSilenceTimer();
              } else if (text) {
                setIsSpeaking(true);
                clearTimeout(silenceTimerRef.current);
              }
            } else {
              // Interim result
              if (text) {
                setInterimTranscript(text);
                setIsSpeaking(true);
                hasSpokenRef.current = true;
                clearTimeout(silenceTimerRef.current);
              }
            }
          }
        } catch (err) {
          console.warn('[Deepgram] Failed to parse message:', err);
        }
      };

      ws.onerror = (err) => {
        console.error('[Deepgram] WebSocket error:', err);
      };

      ws.onclose = (event) => {
        console.log('[Deepgram] WebSocket closed:', event.code, event.reason);
        if (wantListeningRef.current) {
          // Unexpected close — stop gracefully
          setIsListening(false);
          setIsSpeaking(false);
        }
      };
    } catch (err) {
      console.error('[Deepgram] Failed to start:', err);
      wantListeningRef.current = false;
      setIsListening(false);
      setIsSpeaking(false);
    }
  }, [deepgramKey, cleanup, resetSilenceTimer]);

  const stopListening = useCallback(() => {
    wantListeningRef.current = false;
    clearTimeout(silenceTimerRef.current);
    cleanup();
    setIsListening(false);
    setIsSpeaking(false);
  }, [cleanup]);

  const resetTranscript = useCallback(() => {
    accumulatedRef.current = '';
    lastFinalTextRef.current = '';
    hasSpokenRef.current = false;
    setTranscript('');
    setInterimTranscript('');
  }, []);

  return {
    transcript,
    interimTranscript,
    isListening,
    isSupported,
    isSpeaking,
    startListening,
    stopListening,
    resetTranscript,
  };
}
