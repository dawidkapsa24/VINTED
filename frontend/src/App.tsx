import { useEffect, useState } from "react";
import { Dropzone } from "./components/Dropzone";
import "./App.css";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:8080";

type Status = "idle" | "loading" | "done" | "error";

function useObjectUrl(file: File | null) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return url;
}

function App() {
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [garmentFile, setGarmentFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [resultImageUrl, setResultImageUrl] = useState<string | null>(null);

  const modelPreview = useObjectUrl(modelFile);
  const garmentPreview = useObjectUrl(garmentFile);

  async function handleGenerate() {
    if (!modelFile || !garmentFile) return;

    setStatus("loading");
    setError(null);
    setResultImageUrl(null);

    const formData = new FormData();
    formData.append("model_image", modelFile);
    formData.append("garment_image", garmentFile);

    try {
      const res = await fetch(`${BACKEND_URL}/api/tryon`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Nieznany błąd");
      }

      const imageUrl = data.result?.images?.[0]?.url;
      if (!imageUrl) {
        throw new Error("Brak zdjęcia w odpowiedzi");
      }

      setResultImageUrl(imageUrl);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }

  const canGenerate = Boolean(modelFile && garmentFile) && status !== "loading";

  return (
    <div className="page">
      <div className="blob blob-a" />
      <div className="blob blob-b" />

      <div className="card">
        <div className="brand">
          <div className="brand-mark">V+</div>
          <h1>Vougly+</h1>
        </div>
        <p className="subtitle">
          Wgraj zdjęcie modela i ubrania — AI wygeneruje fotorealistyczną przymiarkę w kilkanaście sekund.
        </p>

        <div className="dropzones">
          <Dropzone
            label="Model"
            hint="Zdjęcie osoby"
            file={modelFile}
            previewUrl={modelPreview}
            onSelect={setModelFile}
            onClear={() => setModelFile(null)}
          />
          <Dropzone
            label="Ubranie"
            hint="Zdjęcie produktu"
            file={garmentFile}
            previewUrl={garmentPreview}
            onSelect={setGarmentFile}
            onClear={() => setGarmentFile(null)}
          />
        </div>

        <button className="generate-btn" disabled={!canGenerate} onClick={handleGenerate}>
          {status === "loading" ? (
            <>
              <span className="spinner" />
              Generuję…
            </>
          ) : (
            "Generuj przymiarkę"
          )}
        </button>

        {status === "loading" && (
          <div className="progress-track">
            <div className="progress-fill" />
          </div>
        )}

        {status === "error" && (
          <div className="alert">
            <span>⚠</span>
            <span>{error}</span>
          </div>
        )}

        {resultImageUrl && (
          <div className="result">
            <div className="result-heading">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Wynik
            </div>
            <div className="result-image-wrap">
              <img src={resultImageUrl} alt="Wygenerowana przymiarka" />
            </div>
            <div className="result-actions">
              <a className="btn-secondary" href={resultImageUrl} target="_blank" rel="noreferrer" download>
                Pobierz zdjęcie
              </a>
              <button className="btn-secondary" onClick={handleGenerate}>
                Generuj ponownie
              </button>
            </div>
          </div>
        )}

        <p className="footer-note">Faza 1 · MVP · fal.ai FASHN v1.6</p>
      </div>
    </div>
  );
}

export default App;
