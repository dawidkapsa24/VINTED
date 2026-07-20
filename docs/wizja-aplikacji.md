# Aplikacja: AI zdjęcia ubrań + opis (roboczo "Vougly+")

Cel MVP: aplikacja webowa (Twój stack: React + Vite + Node/TS + Cloud Run), do użytku personalnego.
Wgrywasz zdjęcie ubrania (+ opcjonalnie metki), dostajesz zdjęcie na modelu/tle + gotowy opis pod Vinted.

---

## 1. Flow użytkownika (ekrany)

```
[1. Ekran główny / Nowa generacja]
      |
      v
[2. Upload zdjęcia ubrania]  --(opcjonalnie)-->  [2b. Upload zdjęcia metki]
      |                                                    |
      v                                                    v
[3. Wybór modela/tła]                          [OCR + AI odczyt: marka,
   - galeria modeli                              rozmiar, skład materiału]
   - własne zdjęcie (Ty jako model)
   - tło produktowe (wieszak/łóżko/marmur)
      |
      v
[4. Pole "dodatkowe info"]  <- user dopisuje: kolor, wzór, wady, fason
   (opcjonalne, poprawia jakość generacji)
      |
      v
[5. Generacja]  --async job-->  [status: "generuję..." ~15-30s]
      |
      v
[6. Wynik: zdjęcie + wygenerowany opis]
   - edytowalny opis (user poprawia przed publikacją)
   - podgląd zdjęcia w pełnej rozdzielczości
   - przyciski: Pobierz zdjęcie / Kopiuj opis / Zapisz w archiwum
      |
      v
[7. Archiwum]
   - lista wszystkich generacji (filtr: wszystkie / na modelu / na tle)
   - każda pozycja: zdjęcie + opis + data
```

Kluczowa zasada UX (z analizy Vougly): **model wybrany raz, powtarzalny** — jeśli user
wybierze "bądź swoim modelem", to zdjęcie referencyjne zapisuje się w profilu i jest
domyślnie używane przy każdej kolejnej generacji, bez ponownego uploadu.

---

## 2. Architektura systemu

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│  Frontend        │     │  Backend API      │     │  Storage             │
│  React + Vite     │────▶│  Node/TS (Express │────▶│  Cloud Storage/GCS   │
│  (Cloud Run/      │     │  lub Fastify)     │     │  - zdjęcia oryginalne│
│   Firebase Hosting)│     │  Cloud Run        │     │  - zdjęcia wygenerowane│
└─────────────────┘     └────────┬──────────┘     └─────────────────────┘
                                  │
                    ┌─────────────┼──────────────┐
                    │             │              │
                    v             v              v
            ┌───────────┐ ┌─────────────┐ ┌──────────────┐
            │ fal.ai     │ │ Claude API   │ │ Baza danych   │
            │ (virtual   │ │ (OCR metki + │ │ Postgres/     │
            │ try-on)    │ │ generacja    │ │ Firestore     │
            │            │ │ opisu)       │ │ (metadata,    │
            └───────────┘ └─────────────┘ │ archiwum, user)│
                                            └──────────────┘
```

Wzorce z Twoich istniejących projektów (Vapi/agent głosowy) da się tu przenieść 1:1:
async job pattern (webhook/polling zamiast trzymania połączenia otwartego przez 20-30s
generacji), storage w GCS, backend na Cloud Run w europe-central2.

---

## 3. Komponenty AI — konkretny wybór

### a) Virtual try-on (zdjęcie ubrania → zdjęcie na modelu)

Rekomendacja: **fal.ai** jako warstwa pośrednicząca (jeden SDK, wiele modeli, łatwa zmiana).

| Model | Cena/generację | Charakterystyka |
|---|---|---|
| **FASHN v1.6** | ~$0.075 | najlepsza wierność wzoru/tekstu na ubraniu (864×1296), auto-detekcja kategorii (top/bottom/dress) |
| **Kling Kolors v1.5** | ~$0.07 | prostszy input (2 zdjęcia: osoba + ubranie), dobra fotorealistyczność |
| **FLUX 2 LoRA** | zmienna | więcej kontroli, ale bardziej złożony setup |

Do MVP: **zacznij od FASHN v1.6** — Vougly w swoim FAQ podkreśla wierność wzoru/koloru jako
główną przewagę nad konkurencją, a to dokładnie mocna strona FASHN.

Integracja (Node/TS):
```ts
import { fal } from "@fal-ai/client";

const result = await fal.subscribe("fal-ai/fashn/tryon/v1.6", {
  input: {
    model_image_url: modelPhotoUrl,      // galeria modeli lub zdjęcie usera
    garment_image_url: garmentPhotoUrl,  // zdjęcie ubrania z uploadu
    category: "auto"                     // auto-detekcja top/bottom/one-piece
  }
});
```

### b) OCR metki + generacja opisu

Użyj Claude API (masz już z tym doświadczenie z projektu głosowego):

1. **Odczyt metki** — zdjęcie metki jako obraz w wiadomości do Claude, prompt z instrukcją
   zwrotu strukturalnego JSON:
   ```json
   { "marka": "Zara", "rozmiar": "M", "sklad": "65% bawełna, 35% poliester", "uwagi": null }
   ```
   Ważne: metki bywają nieczytelne/częściowe — traktuj to jako *sugestię do poprawy przez
   usera*, nie pewnik. Pokaż formularz z wypełnionymi polami do edycji, nie publikuj wprost.

2. **Generacja opisu** — osobne wywołanie, łączy dane z metki + wizualny opis zdjęcia
   (kolor, typ, fason) + pole "dodatkowe info" od usera → gotowy tekst pod Vinted:
   krótkie zdania, słowa kluczowe pod wyszukiwarkę ("Zara bluzka M jak nowa, 100% bawełna").

Obie funkcje można połączyć w jedno wywołanie z multiple images, jeśli chcesz oszczędzić
requesty — ale rozdzielenie ułatwia debugging i pozwala userowi zaakceptować dane z metki
zanim wygeneruje się opis.

---

## 4. Model danych (szkic schematu)

```
users
  id, email, default_model_photo_url, created_at

garments (jedna "sesja" = jedno ubranie)
  id, user_id, original_photo_url, tag_photo_url,
  extracted_brand, extracted_size, extracted_material,
  extra_info (text), created_at

generations
  id, garment_id, mode (model/backdrop), model_or_backdrop_id,
  result_image_url, status (pending/done/failed),
  generated_description (text, editowalny), created_at
```

---

## 5. Kolejność budowy (fazy MVP)

**Faza 1 — rdzeń (najpierw to, żeby sprawdzić czy pomysł w ogóle "wypala")**
1. Upload zdjęcia ubrania → wywołanie fal.ai (FASHN) → wyświetlenie wyniku. Bez logowania,
   bez bazy, wszystko w jednej sesji przeglądarki. Cel: sprawdzić jakość generacji na
   Twoich prawdziwych ubraniach zanim zainwestujesz czas w resztę.
2. Jeśli jakość Cię przekona → dodaj wybór modela z małej galerii (2-3 modele) + opcję
   "użyj mojego zdjęcia".

**Faza 2 — opis**
3. Upload zdjęcia metki → OCR/ekstrakcja danych → formularz do poprawy.
4. Generacja opisu na bazie zebranych danych.

**Faza 3 — użyteczność**
5. Baza danych + archiwum (żeby nie gubić wygenerowanych zdjęć).
6. Logowanie (jeśli w ogóle potrzebne przy użytku czysto personalnym — na start możesz
   to pominąć).

**Nie buduj na starcie:** integracji z Vinted (brak publicznego API, ryzyko ToS), panelu
dla butików B2B, sugestii cenowej — to wszystko etap 2+, po walidacji na sobie.

---

## 6. Koszt jednostkowy (orientacyjnie)

- Virtual try-on (fal.ai/FASHN): ~$0.075/generację
- OCR metki (Claude, obraz + krótki tekst): ułamek centa
- Generacja opisu (Claude, tekst): ułamek centa

Przy użytku personalnym (kilkanaście-kilkadziesiąt generacji/miesiąc) to praktycznie
grosze — nie ma sensu na tym etapie myśleć o modelu cenowym, dopiero przy B2B.

---

## 7. Na potem (nie teraz)

- **B2B dla butików**: osobny panel, batch upload wielu produktów, białe etykietowanie,
  integracja z ich sklepem (Shopify/WooCommerce). Rozważ dopiero po tym, jak jakość
  generacji przejdzie Twój własny test na realnych ubraniach.
- **Sugestia ceny**: wymaga danych sprzedażowych z Vinted — osobny, trudniejszy temat.
- **Auto-publikacja na Vinted**: brak publicznego API, prawdopodobnie tylko przez
  automatyzację przeglądarki — ryzykowne i kruche technicznie.
