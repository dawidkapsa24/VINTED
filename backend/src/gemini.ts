import { GoogleGenAI, Type } from "@google/genai";
import { env } from "./env.js";

const MODEL = "gemini-3.1-flash-lite";

export interface TagData {
  marka: string | null;
  rozmiar: string | null;
  sklad: string | null;
  uwagi: string | null;
}

function client() {
  return new GoogleGenAI({ apiKey: env.geminiKey });
}

export async function extractTagData(imageBase64: string, mimeType: string): Promise<TagData> {
  const response = await client().models.generateContent({
    model: MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { data: imageBase64, mimeType } },
          {
            text:
              "To jest zdjęcie metki ubrania. Odczytaj z niej markę, rozmiar i skład materiału. " +
              "Metki bywają nieczytelne lub częściowe — jeśli czegoś nie widać wyraźnie, zwróć null " +
              "dla tego pola zamiast zgadywać. Pole 'uwagi' wypełnij tylko jeśli na metce jest coś " +
              "istotnego poza marką/rozmiarem/składem (np. instrukcje prania).",
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          marka: { type: Type.STRING, nullable: true },
          rozmiar: { type: Type.STRING, nullable: true },
          sklad: { type: Type.STRING, nullable: true },
          uwagi: { type: Type.STRING, nullable: true },
        },
        required: ["marka", "rozmiar", "sklad", "uwagi"],
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error("Brak odpowiedzi z Gemini (odczyt metki)");
  return JSON.parse(text) as TagData;
}

export async function generateDescription(params: {
  garmentImageBase64: string;
  garmentMimeType: string;
  tagData: Partial<TagData>;
  extraInfo: string;
}): Promise<string> {
  const { garmentImageBase64, garmentMimeType, tagData, extraInfo } = params;

  const promptLines = [
    "Napisz krótki, atrakcyjny opis tego ubrania pod ogłoszenie sprzedażowe na Vinted, po polsku.",
    "Użyj krótkich zdań i słów kluczowych pod wyszukiwarkę (marka, typ ubrania, rozmiar, materiał, stan).",
    "Opisz też wygląd na podstawie zdjęcia: kolor, wzór, fason.",
    "Dane z metki (mogą być niepełne lub puste — pomiń brakujące, nie zmyślaj):",
    `Marka: ${tagData.marka ?? "nieznana"}`,
    `Rozmiar: ${tagData.rozmiar ?? "nieznany"}`,
    `Skład: ${tagData.sklad ?? "nieznany"}`,
  ];
  if (extraInfo.trim()) {
    promptLines.push(`Dodatkowe informacje od sprzedającego: ${extraInfo.trim()}`);
  }
  promptLines.push("Zwróć wyłącznie gotowy tekst opisu, bez nagłówków ani komentarzy.");

  const response = await client().models.generateContent({
    model: MODEL,
    contents: [
      {
        role: "user",
        parts: [{ inlineData: { data: garmentImageBase64, mimeType: garmentMimeType } }, { text: promptLines.join("\n") }],
      },
    ],
  });

  const text = response.text;
  if (!text) throw new Error("Brak odpowiedzi z Gemini (generacja opisu)");
  return text.trim();
}
