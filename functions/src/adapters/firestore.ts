import * as admin from "firebase-admin";
import {
  MatchReport,
  Player,
  Team,
  Coach,
  ProUser,
} from "../types";
import { logger } from "../logger";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

export const colUsers = () => db.collection("users");
export const colMappings = () => db.collection("proUserMappings");
export const colOnboarding = () => db.collection("onboardingSessions");

export const colMatchReports = () => db.collection("matchReports");
export const colPlayers = () => db.collection("players");
export const colTeams = () => db.collection("teams");
export const colCoaches = () => db.collection("coaches");

/** Utility: strip ID key if present */
function stripId<T extends Record<string, unknown>>(data: T | undefined | null): Omit<T, "id"> {
  if (!data) return {} as Omit<T, "id">;
  const { id: _ignored, ...rest } = data as any;
  return rest;
}

// --- USER + MAPPING HELPERS ---

export async function findProUserByPhone(phone: string): Promise<ProUser | null> {
  const snap = await colMappings().where("whatsappPhoneNumber", "==", phone).limit(1).get();
  if (snap.empty) return null;

  const mapDoc = snap.docs[0];
  const userId = mapDoc.id;
  const userDoc = await colUsers().doc(userId).get();
  if (!userDoc.exists) return null;

  const data = stripId<ProUser>(userDoc.data() as ProUser);
  if (data.proSubscriptionStatus !== "active") return null;
  return { ...data, id: userId };
}

export async function findUserByEmailLower(emailLower: string): Promise<ProUser | null> {
  const snap = await colUsers().where("email", "==", emailLower).limit(1).get();
  if (snap.empty) return null;

  const doc = snap.docs[0];
  const data = stripId<ProUser>(doc.data() as ProUser);
  return { ...data, id: doc.id };
}

export async function createMappingForUser(userId: string, phone: string) {
  await colMappings().doc(userId).set(
    { whatsappPhoneNumber: phone, proSubscriptionStatus: "active" },
    { merge: true }
  );
  logger.info({ userId, phone }, "Created phone mapping");
}

// --- ONBOARDING ---

export async function getOnboarding(phone: string) {
  const ref = colOnboarding().doc(phone);
  const doc = await ref.get();
  return { exists: doc.exists, data: doc.data(), ref };
}

// --- RAG: LIST FUNCTIONS ---

export async function listMatchReports(limit = 500): Promise<MatchReport[]> {
  const snap = await colMatchReports().limit(limit).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as MatchReport));
}

export async function listPlayers(limit = 500): Promise<Player[]> {
  const snap = await colPlayers().limit(limit).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Player));
}

export async function listTeams(limit = 500): Promise<Team[]> {
  const snap = await colTeams().limit(limit).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Team));
}

export async function listCoaches(limit = 500): Promise<Coach[]> {
  const snap = await colCoaches().limit(limit).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Coach));
}

/** Generic batch loader */
export async function loadDocsByIds<T>(collection: string, ids: string[]): Promise<T[]> {
  if (!ids.length) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10));
  const out: T[] = [];

  for (const chunk of chunks) {
    const snap = await db
      .collection(collection)
      .where(admin.firestore.FieldPath.documentId(), "in", chunk)
      .get();
    snap.forEach((d) => out.push({ id: d.id, ...d.data() } as T));
  }
  return out;
}
