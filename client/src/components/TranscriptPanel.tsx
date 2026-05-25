import { useEffect, useRef } from 'react';
import type { TranscriptEntry } from '../types/realtime';

interface Props {
  entries: TranscriptEntry[];
  /** Currently streaming AI text (not yet finalized into a transcript entry). */
  streamingAIText?: string;
  personaName: string;
}

export default function TranscriptPanel({ entries, streamingAIText, personaName }: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [entries, streamingAIText]);

  return (
    <div className="transcript-panel">
      {entries.map((e, i) => (
        <div key={i} className={`transcript-entry transcript-${e.role}`}>
          <span className="transcript-speaker">{e.role === 'interviewer' ? personaName : 'You'}</span>
          <p className="transcript-text">{e.content}</p>
        </div>
      ))}
      {streamingAIText && (
        <div className="transcript-entry transcript-interviewer transcript-streaming">
          <span className="transcript-speaker">{personaName}</span>
          <p className="transcript-text">{streamingAIText}<span className="cursor">|</span></p>
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}
