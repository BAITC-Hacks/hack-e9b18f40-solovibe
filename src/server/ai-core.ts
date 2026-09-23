import { createOpenAI } from "@ai-sdk/openai";
export function getLanguageModel() {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");
  return createOpenAI({ apiKey: process.env.OPENAI_API_KEY }).responses(process.env.OPENAI_MODEL ?? "gpt-6-luna");
}
export const openaiOptions = { openai: { serviceTier: "default" as const } };
