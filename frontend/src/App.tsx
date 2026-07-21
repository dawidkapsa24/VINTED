import { useEffect, useState } from "react";
import { Dropzone } from "./components/Dropzone";
import { clearDefaultModel, hasDefaultModel, loadDefaultModel, saveDefaultModel } from "./lib/defaultModel";
import "./App.css";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:8080";

type Status = "idle" | "loading" | "done" | "error";
type ModelGender = "any" | "female" | "male";

interface TagFields {
  marka: string;
  rozmiar: string;
  sklad: string;
}

const EMPTY_TAG: TagFields = { marka: "", rozmiar: "", sklad: "" };

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
  const [rememberModel, setRememberModel] = useState(hasDefaultModel);
  const [showModelSection, setShowModelSection] = useState(hasDefaultModel);
  const [modelGender, setModelGender] = useState<ModelGender>("any");

  const [imageStatus, setImageStatus] = useState<Status>("idle");
  const [imageError, setImageError] = useState<string | null>(null);
  const [resultImageUrl, setResultImageUrl] = useState<string | null>(null);

  const [tagFile, setTagFile] = useState<File | null>(null);
  const [tagStatus, setTagStatus] = useState<Status>("idle");
  const [tagError, setTagError] = useState<string | null>(null);
  const [tagFields, setTagFields] = useState<TagFields>(EMPTY_TAG);
  const [extraInfo, setExtraInfo] = useState("");

  const [descriptionStatus, setDescriptionStatus] = useState<Status>("idle");
  const [descriptionError, setDescriptionError] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [copied, setCopied] = useState(false);

  const modelPreview = useObjectUrl(modelFile);
  const garmentPreview = useObjectUrl(garmentFile);
  const tagPreview = useObjectUrl(tagFile);

  useEffect(() => {
    const saved = loadDefaultModel();
    if (saved) setModelFile(saved);
  }, []);

  function handleModelSelect(file: File) {
    setModelFile(file);
    if (rememberModel) void saveDefaultModel(file);
  }

  function handleModelClear() {
    setModelFile(null);
    setRememberModel(false);
    clearDefaultModel();
  }

  function handleToggleModelSection() {
    setShowModelSection((open) => {
      const next = !open;
      if (!next) handleModelClear();
      return next;
    });
  }

  function handleRememberToggle(checked: boolean) {
    setRememberModel(checked);
    if (checked && modelFile) {
      void saveDefaultModel(modelFile);
    } else if (!checked) {
      clearDefaultModel();
    }
  }

  async function handleTagSelect(file: File) {
    setTagFile(file);
    setTagStatus("loading");
    setTagError(null);

    const formData = new FormData();
    formData.append("tag_image", file);

    try {
      const res = await fetch(`${BACKEND_URL}/api/extract-tag`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Nieznany błąd");

      setTagFields({
        marka: data.tagData?.marka ?? "",
        rozmiar: data.tagData?.rozmiar ?? "",
        sklad: data.tagData?.sklad ?? "",
      });
      setTagStatus("done");
    } catch (err) {
      setTagError(err instanceof Error ? err.message : String(err));
      setTagStatus("error");
    }
  }

  function handleTagClear() {
    setTagFile(null);
    setTagFields(EMPTY_TAG);
    setTagStatus("idle");
    setTagError(null);
  }

  async function runTryon() {
    if (!garmentFile) return;
    setImageStatus("loading");
    setImageError(null);
    setResultImageUrl(null);

    const formData = new FormData();
    if (modelFile) {
      formData.append("model_image", modelFile);
    } else if (modelGender !== "any") {
      formData.append("model_gender", modelGender);
    }
    formData.append("garment_image", garmentFile);

    try {
      const res = await fetch(`${BACKEND_URL}/api/tryon`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Nieznany błąd");

      const imageUrl = data.result?.images?.[0]?.url;
      if (!imageUrl) throw new Error("Brak zdjęcia w odpowiedzi");

      setResultImageUrl(imageUrl);
      setImageStatus("done");
    } catch (err) {
      setImageError(err instanceof Error ? err.message : String(err));
      setImageStatus("error");
    }
  }

  async function runDescription() {
    if (!garmentFile) return;
    setDescriptionStatus("loading");
    setDescriptionError(null);
    setDescription("");

    const formData = new FormData();
    formData.append("garment_image", garmentFile);
    formData.append("marka", tagFields.marka);
    formData.append("rozmiar", tagFields.rozmiar);
    formData.append("sklad", tagFields.sklad);
    formData.append("extra_info", extraInfo);

    try {
      const res = await fetch(`${BACKEND_URL}/api/generate-description`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Nieznany błąd");

      setDescription(data.description ?? "");
      setDescriptionStatus("done");
    } catch (err) {
      setDescriptionError(err instanceof Error ? err.message : String(err));
      setDescriptionStatus("error");
    }
  }

  async function handleGenerate() {
    if (!garmentFile) return;
    await Promise.all([runTryon(), runDescription()]);
  }

  async function handleCopyDescription() {
    await navigator.clipboard.writeText(description);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  const isGenerating = imageStatus === "loading" || descriptionStatus === "loading";
  const canGenerate = Boolean(garmentFile) && !isGenerating;

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
          Wgraj zdjęcie ubrania — AI dobierze model automatycznie i wygeneruje fotorealistyczną
          przymiarkę oraz opis pod Vinted w kilkanaście sekund.
        </p>

        <div className="dropzones dropzones-single">
          <Dropzone
            label="Ubranie"
            hint="Zdjęcie produktu"
            file={garmentFile}
            previewUrl={garmentPreview}
            onSelect={setGarmentFile}
            onClear={() => setGarmentFile(null)}
          />
        </div>

        {!showModelSection && (
          <>
            <div className="gender-picker">
              {(
                [
                  ["any", "Dowolny"],
                  ["female", "Kobieta"],
                  ["male", "Mężczyzna"],
                ] as [ModelGender, string][]
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`gender-option${modelGender === value ? " active" : ""}`}
                  onClick={() => setModelGender(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <button type="button" className="link-toggle" onClick={handleToggleModelSection}>
              + Użyj własnego zdjęcia jako modela (opcjonalnie)
            </button>
          </>
        )}

        {showModelSection && (
          <div className="model-section">
            <div className="tag-section-header">
              <span>Model (opcjonalnie)</span>
              <button type="button" className="link-toggle link-toggle-inline" onClick={handleToggleModelSection}>
                Użyj domyślnego
              </button>
            </div>
            <Dropzone
              compact
              label="Zdjęcie modela"
              hint="Własne zdjęcie"
              file={modelFile}
              previewUrl={modelPreview}
              onSelect={handleModelSelect}
              onClear={handleModelClear}
            />
            {modelFile && (
              <label className="remember-toggle">
                <input
                  type="checkbox"
                  checked={rememberModel}
                  onChange={(e) => handleRememberToggle(e.target.checked)}
                />
                Zapamiętaj to zdjęcie modela na następny raz
              </label>
            )}
          </div>
        )}

        <div className="tag-section">
          <div className="tag-section-header">
            <span>Metka (opcjonalnie)</span>
            {tagStatus === "loading" && (
              <span className="tag-status">
                <span className="spinner spinner-dark" /> Odczytuję…
              </span>
            )}
            {tagStatus === "done" && <span className="tag-status tag-status-ok">✓ Odczytano</span>}
          </div>

          <Dropzone
            compact
            label="Zdjęcie metki"
            hint="Marka, skład, rozmiar"
            file={tagFile}
            previewUrl={tagPreview}
            onSelect={handleTagSelect}
            onClear={handleTagClear}
          />

          {tagStatus === "error" && (
            <div className="alert">
              <span>⚠</span>
              <span>{tagError}</span>
            </div>
          )}

          {tagFile && tagStatus !== "loading" && (
            <div className="tag-fields">
              <input
                placeholder="Marka"
                value={tagFields.marka}
                onChange={(e) => setTagFields((f) => ({ ...f, marka: e.target.value }))}
              />
              <input
                placeholder="Rozmiar"
                value={tagFields.rozmiar}
                onChange={(e) => setTagFields((f) => ({ ...f, rozmiar: e.target.value }))}
              />
              <input
                placeholder="Skład"
                value={tagFields.sklad}
                onChange={(e) => setTagFields((f) => ({ ...f, sklad: e.target.value }))}
              />
            </div>
          )}

          <textarea
            className="extra-info"
            placeholder="Dodatkowe informacje: kolor, wzór, wady, fason…"
            value={extraInfo}
            onChange={(e) => setExtraInfo(e.target.value)}
            rows={2}
          />
        </div>

        <button className="generate-btn" disabled={!canGenerate} onClick={handleGenerate}>
          {isGenerating ? (
            <>
              <span className="spinner" />
              Generuję…
            </>
          ) : (
            "Generuj przymiarkę i opis"
          )}
        </button>

        {isGenerating && (
          <div className="progress-track">
            <div className="progress-fill" />
          </div>
        )}

        {imageStatus === "error" && (
          <div className="alert">
            <span>⚠</span>
            <span>{imageError}</span>
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

        {(description || descriptionStatus === "loading" || descriptionStatus === "error") && (
          <div className="description-block">
            <div className="result-heading">Opis pod Vinted</div>

            {descriptionStatus === "loading" && <p className="tag-status">Generuję opis…</p>}

            {descriptionStatus === "error" && (
              <div className="alert">
                <span>⚠</span>
                <span>{descriptionError}</span>
              </div>
            )}

            {description && (
              <>
                <textarea
                  className="description-textarea"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={6}
                />
                <button className="btn-secondary" onClick={handleCopyDescription}>
                  {copied ? "Skopiowano ✓" : "Kopiuj opis"}
                </button>
              </>
            )}
          </div>
        )}

        <p className="footer-note">Faza 2 · MVP · fal.ai FASHN v1.6 + Gemini</p>
      </div>
    </div>
  );
}

export default App;
