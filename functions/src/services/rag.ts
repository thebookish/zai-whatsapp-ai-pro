import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config";
import { embedText } from "../adapters/embedding";
import {
  listMatchReports,
  loadMatchReportsByIds,
} from "../adapters/firestore";
import { buildPrompt } from "../promts/templates";
import { logger } from "../logger";
import { MatchReport } from "../types";

// -------------------- Gemini setup --------------------
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const GENERATE_MODEL = "gemini-2.0-flash";

// ---------------- Firestore-based retrieval (cosine) ----------------
function cosineSim(a: number[], b: number[]) {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] || 0;
    const y = b[i] || 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function firestoreTopK(queryVec: number[], k = 6): Promise<string[]> {
  const candidates: MatchReport[] = await listMatchReports(config.fsScanLimit);

  const filtered: Array<MatchReport & { embedding: number[] }> = candidates.filter(
    (c): c is MatchReport & { embedding: number[] } =>
      Array.isArray(c.embedding) && c.embedding.length > 0
  );

  const withScore: Array<{ id: string; score: number }> = filtered.map((c) => ({
    id: c.id,
    score: cosineSim(queryVec, c.embedding),
  }));

  withScore.sort((a, b) => b.score - a.score);
  return withScore.slice(0, k).map((x) => x.id);
}

async function hydrateMatchReports(ids: string[]): Promise<string> {
  const maxDocs = config.ragMaxDocs;
  const maxChars = config.ragMaxChars;
  const reports = await loadMatchReportsByIds(ids);

  const parts: string[] = [];
  let charCount = 0;

  for (const r of reports.slice(0, maxDocs)) {
    const chunk = [
      r.title ? `### ${r.title}` : `### Report ${r.id}`,
      r.url ? `*URL:* ${r.url}` : "",
      r.teamId ? `*Team:* ${r.teamId}` : "",
      "",
      r.text || "",
    ]
      .filter(Boolean)
      .join("\n");

    const safe = chunk.slice(0, Math.max(0, maxChars - charCount));
    if (!safe) continue;

    parts.push(safe);
    charCount += safe.length;
    if (charCount >= maxChars) break;
  }

  return parts.join("\n\n---\n\n");
}

async function retrieveContext(query: string): Promise<string> {
  try {
    const [queryVec] = await embedText([query]);
    if (!queryVec?.length) return "";
    const docIds = await firestoreTopK(queryVec, 6);
    if (!docIds.length) return "";
    return await hydrateMatchReports(docIds);
  } catch (e) {
    logger.error({ err: e }, "retrieveContext failed");
    return "";
  }
}

export async function generateWithRAG(query: string, userId: string): Promise<string> {
  const model = genAI.getGenerativeModel({ model: GENERATE_MODEL });

  const context = await retrieveContext(query);
  const prompt = buildPrompt({
    userId,
    userQuestion: query,
    hydratedContext: context,
    options: { domain: "football", maxWords: 220 },
  });

  const result = await model.generateContent(prompt);
  const text = result?.response?.text?.() ?? "";

  return text || "I'm not finding enough context to answer that.";
}
