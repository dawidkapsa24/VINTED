const STORAGE_KEY = "vougly.defaultModelPhoto";

interface StoredModel {
  name: string;
  type: string;
  dataUrl: string;
}

export function loadDefaultModel(): File | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const stored: StoredModel = JSON.parse(raw);
    const bytes = dataUrlToBytes(stored.dataUrl);
    return new File([bytes.buffer as ArrayBuffer], stored.name, { type: stored.type });
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function saveDefaultModel(file: File): Promise<void> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const stored: StoredModel = {
        name: file.name,
        type: file.type,
        dataUrl: reader.result as string,
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
      } catch {
        // localStorage full or unavailable — nie krytyczne, po prostu nie zapamiętamy zdjęcia
      }
      resolve();
    };
    reader.onerror = () => resolve();
    reader.readAsDataURL(file);
  });
}

export function clearDefaultModel() {
  localStorage.removeItem(STORAGE_KEY);
}

export function hasDefaultModel(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null;
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
