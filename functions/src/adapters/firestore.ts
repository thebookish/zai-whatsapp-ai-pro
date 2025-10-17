import * as admin from "firebase-admin";
import { MatchReport, ProUser, } from "../types";
import { logger } from "../logger";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

export const colUsers = () => db.collection("users");
export const colMappings = () => db.collection("proUserMappings");
export const colOnboarding = () => db.collection("onboardingSessions");

// Your seeded reports live here
export const colMatchReports = () => db.collection("matchReports");

/** Helper: strip any accidental 'id' stored inside doc data to avoid spread overwrite */
function stripId<T extends Record<string, unknown>>(data: T | undefined | null): Omit<T, "id"> {
  if (!data) return {} as Omit<T, "id">;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _ignored, ...rest } = data as any;
  return rest;
}

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

export async function getOnboarding(phone: string) {
  const ref = colOnboarding().doc(phone);
  const doc = await ref.get();
  return { exists: doc.exists, data: doc.data(), ref };
}

/** List up to `limit` match reports from Firestore. */
export async function listMatchReports(limit = 500): Promise<MatchReport[]> {
  const snap = await colMatchReports().limit(limit).get();
  const out: MatchReport[] = [];
  snap.forEach((d) => {
    const data = stripId<MatchReport>(d.data() as any);
    out.push({
      id: d.id,
      title: data.title,
      text: data.text,
      url: data.url,
      teamId: data.teamId,
      embedding: data.embedding,
      createdAt: data.createdAt,
    });
  });
  return out;
}

/** Batch load match reports by IDs (chunks of 10 due to Firestore 'in' limit). */
export async function loadMatchReportsByIds(ids: string[]): Promise<MatchReport[]> {
  if (!ids.length) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10));

  const out: MatchReport[] = [];
  for (const chunk of chunks) {
    const snap = await colMatchReports()
      .where(admin.firestore.FieldPath.documentId(), "in", chunk)
      .get();
    snap.forEach((d) => {
      const data = stripId<MatchReport>(d.data() as any);
      out.push({
        id: d.id,
        title: data.title,
        text: data.text,
        url: data.url,
        teamId: data.teamId,
        embedding: data.embedding,
        createdAt: data.createdAt,
      });
    });
  }
  return out;
}
