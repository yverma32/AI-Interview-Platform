import { useEffect, useState } from 'react';

interface Props {
  /** Unix ms when the session became active. Null pauses the timer. */
  startedAt: number | null;
}

export default function InterviewTimer({ startedAt }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (startedAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const elapsed = startedAt === null ? 0 : Math.floor((now - startedAt) / 1000);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  return <span className="interview-timer">{mm}:{ss}</span>;
}
