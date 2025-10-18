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
import { getMemory, setMemory } from "./conversationMemory";

// ---------------- Gemini setup ----------------
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const GENERATE_MODEL = "gemini-2.0-flash";

// ---------- COSINE SIM ----------
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

// ---------- HYDRATE DOCS ----------
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
    make(
      "Match Reports",
      reports,
      (r) =>
        `**${r.title}**\n${r.text}\n${r.url ? `URL: ${r.url}` : ""}`
    ),
    make(
      "Players",
      players,
      (p) =>
        `**${p.name}** (${p.position}, ${p.teamId})\nStrengths: ${p.strengths}\nStats: ${JSON.stringify(
          p.stats ?? {}
        )}`
    ),
    make(
      "Teams",
      teams,
      (t) =>
        `**${t.name}** (${t.division})\nFormation: ${t.formation}\nStyle: ${t.style}`
    ),
    make(
      "Coaches",
      coaches,
      (c) =>
        `**${c.name}** (${c.teamId})\nExperience: ${c.experience}\nPhilosophy: ${c.philosophy}`
    ),
  ].join("\n\n");
}

// ---------- RETRIEVE CONTEXT ----------
async function retrieveContext(
  query: string,
  sessionId: string
): Promise<{ context: string; detected: { type: string; name: string } | null }> {
  try {
    let effectiveQuery = query;
    const memory = getMemory(sessionId);

    // 🧠 Use memory when user uses pronouns
    if (
      memory &&
      /\b(he|his|her|they|their|that team|that coach|that player)\b/i.test(query)
    ) {
      effectiveQuery = `${query} (referring to ${memory.name})`;
      logger.info({ effectiveQuery, memory }, "💡 Using memory context");
    }

    const [queryVec] = await embedText([effectiveQuery]);
    if (!queryVec?.length) return { context: "", detected: null };

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

    const context = await hydrateData(reportIds, playerIds, teamIds, coachIds);

    // 🧩 Identify most likely entity and store it in memory
    let detected: { type: string; name: string } | null = null;

    if (playerIds.length) {
      const player = players.find((p) => p.id === playerIds[0]);
      if (player) detected = { type: "player", name: player.name };
    } else if (coachIds.length) {
      const coach = coaches.find((c) => c.id === coachIds[0]);
      if (coach) detected = { type: "coach", name: coach.name };
    } else if (teamIds.length) {
      const team = teams.find((t) => t.id === teamIds[0]);
      if (team) detected = { type: "team", name: team.name };
    } else if (reportIds.length) {
      const report = reports.find((r) => r.id === reportIds[0]);
      if (report) detected = { type: "match", name: report.title };
    }

    if (detected) {
      setMemory(sessionId, detected.type as any, detected.name);
      logger.info({ sessionId, detected }, "🧠 Memory updated");
    }

    return { context, detected };
  } catch (err) {
    logger.error({ err }, "❌ retrieveContext failed");
    return { context: "", detected: null };
  }
}

// ---------- GENERATE WITH MEMORY-AWARE RAG ----------
export async function generateWithRAG(
  query: string,
  sessionId: string
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: GENERATE_MODEL });

  // 🧠 Check for existing memory context
  const memory = getMemory(sessionId);
  let effectiveQuery = query;

  if (
    memory &&
    /\b(he|his|her|they|their|that team|that coach|that player)\b/i.test(query)
  ) {
    effectiveQuery = `${query} (referring to ${memory.name})`;
    logger.info({ sessionId, effectiveQuery }, "🔁 Memory reused");
  }

  // 🔍 Retrieve RAG context
  const { context, detected } = await retrieveContext(effectiveQuery, sessionId);

  // 💾 Update memory if new entity found
  if (detected) setMemory(sessionId, detected.type as any, detected.name);

  // 🧩 Build prompt
  const prompt = buildPrompt({
    userId: sessionId,
    userQuestion: effectiveQuery,
    hydratedContext: context,
    options: { domain: "football", maxWords: 220 },
  });

  // ✨ Generate final response
  try {
    const result = await model.generateContent(prompt);
    const text = result?.response?.text?.() ?? "";

    if (!text.trim())
      return "Hmm, I couldn’t find much about that — could you share a bit more detail? ⚽️";

    return text.trim();
  } catch (err) {
    logger.error({ err }, "❌ generateWithRAG failed");
    return "Oops, something went wrong while I was checking that. Could you rephrase your question?";
  }
}
