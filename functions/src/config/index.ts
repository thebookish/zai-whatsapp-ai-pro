import { z } from "zod";
import * as functions from "firebase-functions";
import dotenv from "dotenv";
dotenv.config();

const cfg = functions.config?.() || {};

const Schema = z.object({
  gcpProjectId: z.string().min(1),
  gcpLocation: z.string().default("us-central1"),
  voiceBucket: z.string().min(1).default("zai-voice-responses"),
  twilioSid: z.string().optional(),
  twilioAuthToken: z.string().optional(),

  // Onboarding
  onboardingTimeoutMinutes: z.coerce.number().int().positive().default(60),

  // RAG hydration limits
  ragMaxDocs: z.coerce.number().int().positive().default(5),
  ragMaxChars: z.coerce.number().int().positive().default(6000),

  // Firestore scan cap for fallback vector search
  fsScanLimit: z.coerce.number().int().positive().default(500)
});

export const config = Schema.parse({
  gcpProjectId: process.env.GCP_PROJECT_ID || process.env.GCLOUD_PROJECT || "your-gcp-project-id",
  gcpLocation: process.env.GCP_LOCATION || "us-central1",
  voiceBucket: process.env.VOICE_BUCKET || "zai-voice-responses",
  twilioSid: (cfg as any)?.twilio?.sid || process.env.TWILIO_SID,
  twilioAuthToken: (cfg as any)?.twilio?.auth_token || (cfg as any)?.twilio?.authtoken || process.env.TWILIO_AUTH_TOKEN,

  onboardingTimeoutMinutes: process.env.ONBOARDING_TIMEOUT_MINUTES || (cfg as any)?.zai?.onboarding_timeout_minutes || 60,
  ragMaxDocs: process.env.RAG_MAX_DOCS || 5,
  ragMaxChars: process.env.RAG_MAX_CHARS || 6000,
  fsScanLimit: process.env.FS_SCAN_LIMIT || 500
});
