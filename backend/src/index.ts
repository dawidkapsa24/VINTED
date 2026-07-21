import Fastify, { type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { fal } from "@fal-ai/client";
import { env } from "./env.js";
import { extractTagData, generateDescription, type TagData } from "./gemini.js";
import { getRandomDefaultModelUrl } from "./defaultModels.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(multipart, {
  limits: { fileSize: 10 * 1024 * 1024 },
});

interface UploadedFile {
  buffer: Buffer;
  filename: string;
  mimetype: string;
}

async function parseMultipart(request: FastifyRequest) {
  const files: Record<string, UploadedFile> = {};
  const fields: Record<string, string> = {};

  for await (const part of request.parts()) {
    if (part.type === "file") {
      files[part.fieldname] = {
        buffer: await part.toBuffer(),
        filename: part.filename,
        mimetype: part.mimetype,
      };
    } else {
      fields[part.fieldname] = String(part.value);
    }
  }

  return { files, fields };
}

app.get("/api/health", async () => ({ ok: true }));

app.post("/api/tryon", async (request, reply) => {
  if (!env.falKey) {
    return reply.status(500).send({
      error: "FAL_KEY nie jest ustawiony na backendzie. Dodaj go do backend/.env.",
    });
  }
  fal.config({ credentials: env.falKey });

  const { files, fields } = await parseMultipart(request);

  const modelFile = files["model_image"];
  const garmentFile = files["garment_image"];
  const modelGender = fields["model_gender"] === "male" || fields["model_gender"] === "female" ? fields["model_gender"] : undefined;

  if (!garmentFile) {
    return reply.status(400).send({
      error: "Wymagany plik: garment_image (multipart/form-data).",
    });
  }

  try {
    const [modelImageUrl, garmentImageUrl] = await Promise.all([
      modelFile
        ? fal.storage.upload(
            new File([new Uint8Array(modelFile.buffer)], modelFile.filename, {
              type: modelFile.mimetype,
            })
          )
        : getRandomDefaultModelUrl(modelGender),
      fal.storage.upload(
        new File([new Uint8Array(garmentFile.buffer)], garmentFile.filename, {
          type: garmentFile.mimetype,
        })
      ),
    ]);

    const result = await fal.subscribe("fal-ai/fashn/tryon/v1.6", {
      input: {
        model_image: modelImageUrl,
        garment_image: garmentImageUrl,
        category: "auto",
      },
    });

    return { result: result.data };
  } catch (err) {
    request.log.error(err);
    return reply.status(502).send({ error: "Generacja nie powiodła się.", detail: `${err}` });
  }
});

app.post("/api/extract-tag", async (request, reply) => {
  if (!env.geminiKey) {
    return reply.status(500).send({
      error: "GEMINI_API_KEY nie jest ustawiony na backendzie. Dodaj go do backend/.env.",
    });
  }

  const { files } = await parseMultipart(request);
  const tagFile = files["tag_image"];

  if (!tagFile) {
    return reply.status(400).send({ error: "Wymagany plik: tag_image (multipart/form-data)." });
  }

  try {
    const tagData = await extractTagData(tagFile.buffer.toString("base64"), tagFile.mimetype);
    return { tagData };
  } catch (err) {
    request.log.error(err);
    return reply.status(502).send({ error: "Odczyt metki nie powiódł się.", detail: `${err}` });
  }
});

app.post("/api/generate-description", async (request, reply) => {
  if (!env.geminiKey) {
    return reply.status(500).send({
      error: "GEMINI_API_KEY nie jest ustawiony na backendzie. Dodaj go do backend/.env.",
    });
  }

  const { files, fields } = await parseMultipart(request);
  const garmentFile = files["garment_image"];

  if (!garmentFile) {
    return reply.status(400).send({ error: "Wymagany plik: garment_image (multipart/form-data)." });
  }

  const tagData: Partial<TagData> = {
    marka: fields["marka"] || null,
    rozmiar: fields["rozmiar"] || null,
    sklad: fields["sklad"] || null,
  };

  try {
    const description = await generateDescription({
      garmentImageBase64: garmentFile.buffer.toString("base64"),
      garmentMimeType: garmentFile.mimetype,
      tagData,
      extraInfo: fields["extra_info"] ?? "",
    });
    return { description };
  } catch (err) {
    request.log.error(err);
    return reply.status(502).send({ error: "Generacja opisu nie powiodła się.", detail: `${err}` });
  }
});

app
  .listen({ port: env.port, host: "0.0.0.0" })
  .then((address) => app.log.info(`Backend listening on ${address}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
