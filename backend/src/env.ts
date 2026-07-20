import "dotenv/config";

export const env = {
  port: Number(process.env.PORT ?? 8080),
  falKey: process.env.FAL_KEY ?? "",
  geminiKey: process.env.GEMINI_API_KEY ?? "",
};
