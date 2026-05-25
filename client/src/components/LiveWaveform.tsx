import { useEffect, useRef } from 'react';

type Mode = 'ai' | 'user' | 'idle';

interface Props {
  /** Active audio stream (mic or remote). Null when idle. */
  stream: MediaStream | null;
  mode: Mode;
}

/**
 * Animated waveform driven by the Web Audio AnalyserNode. Switches colour by mode.
 * Idle mode renders a flat baseline.
 */
export default function LiveWaveform({ stream, mode }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!stream || mode === 'idle') {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, canvas.height / 2);
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
      return;
    }

    const audioCtx = new AudioContext();
    audioCtxRef.current = audioCtx;
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const bufferLength = analyser.frequencyBinCount;
    const data = new Uint8Array(bufferLength);

    const draw = () => {
      analyser.getByteTimeDomainData(data);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 2;
      ctx.strokeStyle = mode === 'ai' ? '#6366f1' : '#10b981';
      ctx.beginPath();
      const sliceWidth = canvas.width / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = data[i] / 128.0;
        const y = (v * canvas.height) / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.stroke();
      rafRef.current = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      audioCtx.close().catch(() => {});
    };
  }, [stream, mode]);

  return <canvas ref={canvasRef} width={600} height={80} className="live-waveform" />;
}
