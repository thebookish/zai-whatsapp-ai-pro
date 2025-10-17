// Centralized Firebase Admin init that works locally and in prod.

import * as admin from "firebase-admin";
import { config } from "./config";

// Decide the project id
const projectId =
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.GCLOUD_PROJECT ||
  process.env.FIREBASE_CONFIG && (() => {
    try { return JSON.parse(process.env.FIREBASE_CONFIG).projectId; } catch { return undefined; }
  })() ||
  config.gcpProjectId;

// Build credential
function buildCredential(): admin.credential.Credential | undefined {
  // 1) Emulator – no credential needed, Admin SDK will skip auth
  if (process.env.FIRESTORE_EMULATOR_HOST) return undefined;

  // 2) Service account JSON string via env
  if (process.env.SERVICE_ACCOUNT_JSON) {
    try {
      const json = JSON.parse(process.env.SERVICE_ACCOUNT_JSON);
      return admin.credential.cert(json);
    } catch (e) {
      console.warn("[firebase] Failed to parse SERVICE_ACCOUNT_JSON:", e);
    }
  }

  // 3) Service account file via GOOGLE_APPLICATION_CREDENTIALS
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return admin.credential.applicationDefault();
  }

  // 4) ADC via gcloud (application-default login), or GCF/GCP metadata
  return admin.credential.applicationDefault();
}

const app =
  admin.apps.length
    ? admin.app()
    : admin.initializeApp({
        projectId,
        credential: buildCredential(),
      });

export const db = admin.firestore(app);
export { admin };
