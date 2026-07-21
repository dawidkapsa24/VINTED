import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { fal } from "@fal-ai/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_MODELS_DIR = path.join(__dirname, "..", "assets", "default-models");

const uploadCache = new Map<string, string>();

function listDefaultModelFiles(gender?: "male" | "female"): string[] {
  const all = readdirSync(DEFAULT_MODELS_DIR).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
  if (!gender) return all;
  return all.filter((f) => f.startsWith(`${gender}-`));
}

function mimeTypeFor(filename: string): string {
  if (filename.endsWith(".png")) return "image/png";
  if (filename.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

/**
 * Losuje jedno z domyślnych zdjęć modeli (backend/assets/default-models) i zwraca jego URL
 * na fal.storage. Opcjonalnie ograniczone do jednej płci (prefiks nazwy pliku: male- lub female-).
 */
export async function getRandomDefaultModelUrl(gender?: "male" | "female"): Promise<string> {
  const files = listDefaultModelFiles(gender);
  if (files.length === 0) {
    throw new Error("Brak domyślnych zdjęć modeli dla wybranej płci w backend/assets/default-models.");
  }

  const filename = files[Math.floor(Math.random() * files.length)];

  const cached = uploadCache.get(filename);
  if (cached) return cached;

  const buffer = readFileSync(path.join(DEFAULT_MODELS_DIR, filename));
  const url = await fal.storage.upload(
    new File([new Uint8Array(buffer)], filename, { type: mimeTypeFor(filename) })
  );
  uploadCache.set(filename, url);
  return url;
}
