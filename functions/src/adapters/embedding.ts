import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Gemini embeddings using `text-embedding-004`.
 * Pass plain strings to `embedContent` to avoid Content typing issues.
 * Requires: process.env.GEMINI_API_KEY
 */

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const EMBED_MODEL = "text-embedding-004";

function extractVec(resp: any): number[] {
  // SDK shape: { embedding: { values: number[] } }
  return resp?.embedding?.values ?? [];
}

/**
 * Embed an array of texts; returns an array of vectors (one per text).
 */
export async function embedText(texts: string[]): Promise<number[][]> {
  const model = genAI.getGenerativeModel({ model: EMBED_MODEL });

  const out: number[][] = [];
  for (const t of texts) {
    try {
      // Pass a plain string; the SDK handles wrapping it
      const res = await model.embedContent(t);
      out.push(extractVec(res));
    } catch (err) {
      console.error("Embedding error:", err);
      out.push([]);
    }
  }
  return out;
}
