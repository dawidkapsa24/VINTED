import { useState } from "react";
import "./App.css";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:8080";

type Status = "idle" | "loading" | "done" | "error";

function App() {
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [garmentFile, setGarmentFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [resultImageUrl, setResultImageUrl] = useState<string | null>(null);

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

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: "2rem 1rem" }}>
      <h1>Vougly+ — MVP</h1>
      <p>Wgraj zdjęcie modela oraz zdjęcie ubrania, żeby wygenerować przymiarkę.</p>

      <label style={{ display: "block", marginTop: "1.5rem" }}>
        Zdjęcie modela (osoby)
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setModelFile(e.target.files?.[0] ?? null)}
        />
      </label>

      <label style={{ display: "block", marginTop: "1rem" }}>
        Zdjęcie ubrania
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setGarmentFile(e.target.files?.[0] ?? null)}
        />
      </label>

      <button
        type="button"
        style={{ marginTop: "1.5rem" }}
        disabled={!modelFile || !garmentFile || status === "loading"}
        onClick={handleGenerate}
      >
        {status === "loading" ? "Generuję… (~15-30s)" : "Generuj"}
      </button>

      {status === "error" && (
        <p style={{ color: "crimson", marginTop: "1rem" }}>Błąd: {error}</p>
      )}

      {resultImageUrl && (
        <div style={{ marginTop: "1.5rem" }}>
          <h2>Wynik</h2>
          <img src={resultImageUrl} alt="Wygenerowana przymiarka" style={{ maxWidth: "100%" }} />
        </div>
      )}
    </main>
  );
}

export default App;
