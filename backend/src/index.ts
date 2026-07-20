import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { fal } from "@fal-ai/client";
import { env } from "./env.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(multipart, {
  limits: { fileSize: 10 * 1024 * 1024 },
});

app.get("/api/health", async () => ({ ok: true }));

app.post("/api/tryon", async (request, reply) => {
  if (!env.falKey) {
    return reply.status(500).send({
      error: "FAL_KEY nie jest ustawiony na backendzie. Dodaj go do backend/.env.",
    });
  }
  fal.config({ credentials: env.falKey });

  const parts = request.parts();
  const files: Record<string, { buffer: Buffer; filename: string; mimetype: string }> = {};

  for await (const part of parts) {
    if (part.type === "file") {
      files[part.fieldname] = {
        buffer: await part.toBuffer(),
        filename: part.filename,
        mimetype: part.mimetype,
      };
    }
  }

  const modelFile = files["model_image"];
  const garmentFile = files["garment_image"];

  if (!modelFile || !garmentFile) {
    return reply.status(400).send({
      error: "Wymagane pliki: model_image oraz garment_image (multipart/form-data).",
    });
  }

  try {
    const [modelImageUrl, garmentImageUrl] = await Promise.all([
      fal.storage.upload(
        new File([new Uint8Array(modelFile.buffer)], modelFile.filename, {
          type: modelFile.mimetype,
        })
      ),
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

app
  .listen({ port: env.port, host: "0.0.0.0" })
  .then((address) => app.log.info(`Backend listening on ${address}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
