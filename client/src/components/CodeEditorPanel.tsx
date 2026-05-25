import { useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import { Lightbulb } from 'lucide-react';

interface Props {
  open: boolean;
  /** The language the AI suggested. The user can override via the dropdown. */
  language: string;
  prompt: string;
  starterCode?: string;
  /** Called with the candidate's code and the language they actually wrote it in. */
  onSubmit: (code: string, language: string) => void;
  onClose: () => void;
}

const LANGUAGE_OPTIONS = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python',     label: 'Python' },
  { value: 'java',       label: 'Java' },
  { value: 'csharp',     label: 'C#' },
  { value: 'cpp',        label: 'C++' },
  { value: 'go',         label: 'Go' },
  { value: 'rust',       label: 'Rust' },
  { value: 'ruby',       label: 'Ruby' },
  { value: 'php',        label: 'PHP' },
  { value: 'kotlin',     label: 'Kotlin' },
  { value: 'swift',      label: 'Swift' },
  { value: 'sql',        label: 'SQL' },
];

/**
 * Modal-style panel with a Monaco editor. The AI triggers it via a `request_code_input` tool call;
 * when the candidate submits, the code is sent back as a user message + the tool gets a success result.
 *
 * The candidate can change the editor language locally via the dropdown. The submitted code is
 * fenced with whichever language is currently selected so the AI evaluates it correctly.
 */
export default function CodeEditorPanel({ open, language, prompt, starterCode, onSubmit, onClose }: Props) {
  const [code, setCode] = useState(starterCode ?? '');
  const [activeLanguage, setActiveLanguage] = useState(normalizeLanguage(language));

  useEffect(() => {
    if (open) {
      setCode(starterCode ?? '');
      setActiveLanguage(normalizeLanguage(language));
    }
  }, [open, starterCode, language]);

  if (!open) return null;

  return (
    <div className="code-editor-overlay">
      <div className="code-editor-panel">
        <header className="code-editor-header">
          <div>
            <h3>Write your solution</h3>
            <p className="code-editor-prompt">{prompt}</p>
            <p className="code-editor-hint">
              <Lightbulb size={14} aria-hidden />{' '}
              Not your preferred language? Pick from the dropdown, or just say it out loud
              (e.g. "let me do this in Python") and the interviewer will update the prompt.
            </p>
          </div>
          <div className="code-editor-actions">
            <select
              className="code-editor-lang-select"
              value={activeLanguage}
              onChange={(e) => setActiveLanguage(e.target.value)}
              aria-label="Programming language"
            >
              {LANGUAGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <button className="ghost-btn" onClick={onClose}>Cancel</button>
            <button
              className="primary-btn"
              onClick={() => onSubmit(code, activeLanguage)}
              disabled={code.trim().length === 0}
            >
              Submit code
            </button>
          </div>
        </header>
        <div className="code-editor-body">
          <Editor
            height="100%"
            language={activeLanguage}
            value={code}
            onChange={(v) => setCode(v ?? '')}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              tabSize: 2,
              automaticLayout: true,
              scrollBeyondLastLine: false,
              wordWrap: 'on',
            }}
          />
        </div>
      </div>
    </div>
  );
}

function normalizeLanguage(input: string): string {
  const l = (input ?? '').toLowerCase().trim();
  const map: Record<string, string> = {
    'js': 'javascript',
    'ts': 'typescript',
    'py': 'python',
    'c#': 'csharp',
    'cs': 'csharp',
    'c++': 'cpp',
    'node': 'javascript',
    'nodejs': 'javascript',
    'react': 'typescript',
  };
  return map[l] ?? (LANGUAGE_OPTIONS.find((o) => o.value === l)?.value ?? 'javascript');
}
