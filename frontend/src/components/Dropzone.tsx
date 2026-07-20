import { useState, type DragEvent } from "react";

interface DropzoneProps {
  label: string;
  hint: string;
  file: File | null;
  previewUrl: string | null;
  onSelect: (file: File) => void;
  onClear: () => void;
}

function UploadIcon() {
  return (
    <svg className="dropzone-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 16V4m0 0 4 4m-4-4-4 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Dropzone({ label, hint, file, previewUrl, onSelect, onClear }: DropzoneProps) {
  const [dragActive, setDragActive] = useState(false);

  function handleDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragActive(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) onSelect(dropped);
  }

  return (
    <label
      className={`dropzone${dragActive ? " drag-active" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
    >
      <input
        type="file"
        accept="image/*"
        onChange={(e) => {
          const selected = e.target.files?.[0];
          if (selected) onSelect(selected);
        }}
      />

      {previewUrl ? (
        <>
          <div className="dropzone-preview">
            <img src={previewUrl} alt={label} />
          </div>
          <span className="dropzone-filename">{file?.name}</span>
          <button
            type="button"
            className="dropzone-clear"
            aria-label={`Usuń: ${label}`}
            onClick={(e) => {
              e.preventDefault();
              onClear();
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          </button>
        </>
      ) : (
        <>
          <UploadIcon />
          <span className="dropzone-label">{label}</span>
          <span className="dropzone-hint">{hint}</span>
        </>
      )}
    </label>
  );
}
