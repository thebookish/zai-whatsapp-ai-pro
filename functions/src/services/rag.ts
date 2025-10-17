import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config";
import { embedText } from "../adapters/embedding";
import {
  listMatchReports,
  listPlayers,
  listTeams,
  listCoaches,
  loadDocsByIds,
} from "../adapters/firestore";
import { buildPrompt } from "../promts/templates";
import { logger } from "../logger";
import { MatchReport, Player, Team, Coach } from "../types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const GENERATE_MODEL = "gemini-2.0-flash";

// ---------- COSINE SIM ----------
function cosineSim(a: number[], b: number[]) {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
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

// ---------- RANK & RETRIEVE ----------
async function topK<T extends { id: string; embedding?: number[] }>(
  queryVec: number[],
  data: T[],
  k = 5
): Promise<string[]> {
  const scored = data
    .filter((d) => Array.isArray(d.embedding) && d.embedding.length)
    .map((d) => ({
      id: d.id,
      score: cosineSim(queryVec, d.embedding!),
    }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k).map((s) => s.id);
}

async function hydrateData(
  reportIds: string[],
  playerIds: string[],
  teamIds: string[],
  coachIds: string[]
): Promise<string> {
  const [reports, players, teams, coaches] = await Promise.all([
    loadDocsByIds<MatchReport>("matchReports", reportIds),
    loadDocsByIds<Player>("players", playerIds),
    loadDocsByIds<Team>("teams", teamIds),
    loadDocsByIds<Coach>("coaches", coachIds),
  ]);

  const make = (label: string, arr: any[], fmt: (x: any) => string) =>
    arr.length ? `### ${label}\n${arr.map(fmt).join("\n\n---\n\n")}\n` : "";

  return [
    make("Match Reports", reports, (r) => `**${r.title}**\n${r.text}\n${r.url ? `URL: ${r.url}` : ""}`),
    make("Players", players, (p) => `**${p.name}** (${p.position}, ${p.teamId})\nStrengths: ${p.strengths}\nStats: ${JSON.stringify(p.stats ?? {})}`),
    make("Teams", teams, (t) => `**${t.name}** (${t.division})\nFormation: ${t.formation}\nStyle: ${t.style}`),
    make("Coaches", coaches, (c) => `**${c.name}** (${c.teamId})\nExperience: ${c.experience}\nPhilosophy: ${c.philosophy}`),
  ].join("\n\n");
}

async function retrieveContext(query: string): Promise<string> {
  try {
    const [queryVec] = await embedText([query]);
    if (!queryVec?.length) return "";

    const [reports, players, teams, coaches] = await Promise.all([
      listMatchReports(config.fsScanLimit),
      listPlayers(config.fsScanLimit),
      listTeams(config.fsScanLimit),
      listCoaches(config.fsScanLimit),
    ]);

    const [reportIds, playerIds, teamIds, coachIds] = await Promise.all([
      topK(queryVec, reports),
      topK(queryVec, players),
      topK(queryVec, teams),
      topK(queryVec, coaches),
    ]);

    return await hydrateData(reportIds, playerIds, teamIds, coachIds);
  } catch (e) {
    logger.error({ err: e }, "retrieveContext failed");
    return "";
  }
}

// ---------- GENERATE ANSWER ----------
export async function generateWithRAG(query: string, userId: string): Promise<string> {
  const model = genAI.getGenerativeModel({ model: GENERATE_MODEL });

  const context = await retrieveContext(query);
  const prompt = buildPrompt({
    userId,
    userQuestion: query,
    hydratedContext: context,
    options: { domain: "football", maxWords: 220 },
  });

  try {
    const result = await model.generateContent(prompt);
    const text = result?.response?.text?.() ?? "";
    return text.trim() || "I'm not finding enough context to answer that.";
  } catch (err) {
    logger.error({ err }, "generateWithRAG failed");
    return "Sorry, something went wrong while generating your response.";
  }
}
