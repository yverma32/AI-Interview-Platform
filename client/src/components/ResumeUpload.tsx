import { useEffect, useRef, useState } from 'react';
import { resumeService, type ResumeResponse } from '../services/resumeService';
import { analytics } from '../services/analytics';

interface Props {
  /** Called when a resume becomes available (newly uploaded or pre-existing). */
  onReady: (resume: ResumeResponse) => void;
}

export default function ResumeUpload({ onReady }: Props) {
  const [resume, setResume] = useState<ResumeResponse | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    resumeService.getLatest().then((r) => {
      if (cancelled || !r) return;
      setResume(r);
      onReady(r);
    });
    return () => { cancelled = true; };
  }, [onReady]);

  const handleFile = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const r = await resumeService.upload(file);
      setResume(r);
      onReady(r);
      analytics.resumeUploaded();
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setError(e.response?.data?.message ?? e.message ?? 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  return (
    <div className="resume-upload">
      <div
        className="resume-dropzone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        {uploading ? (
          <p>Reading your resume…</p>
        ) : resume ? (
          <div className="resume-summary">
            <p><strong>{resume.fileName}</strong></p>
            {resume.parsed && (
              <p className="resume-meta">
                {resume.parsed.projects.length} project{resume.parsed.projects.length !== 1 && 's'}
                {resume.parsed.totalExperience && ` · ${resume.parsed.totalExperience} experience`}
                {resume.parsed.skills.length > 0 && ` · ${resume.parsed.skills.length} skills`}
              </p>
            )}
            <p className="resume-replace">Click to replace</p>
          </div>
        ) : (
          <>
            <p><strong>Drop your resume here</strong> or click to upload</p>
            <p className="resume-meta">PDF or DOCX · 5 MB max</p>
          </>
        )}
      </div>
      {error && <p className="resume-error">{error}</p>}
    </div>
  );
}
