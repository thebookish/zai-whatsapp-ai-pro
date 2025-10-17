import { Twilio, validateRequest } from "twilio";
import { config } from "../config";
import { logger } from "../logger";

function trimTrailingSlash(u: string) {
  return u.endsWith("/") ? u.slice(0, -1) : u;
}

export function getTwilioClient(): Twilio {
  if (!config.twilioSid || !config.twilioAuthToken) {
    logger.warn("Twilio SID/AuthToken missing; set via functions:config or .env");
  }
  return new Twilio(config.twilioSid || "", config.twilioAuthToken || "");
}

/**
 * Validate Twilio signature.
 * - Uses EXTERNAL_URL when present.
 * - If TWILIO_VALIDATE === "false", returns true (dev bypass).
 */
export function validateTwilioSignature(
  signature: string | undefined,
  fullUrl: string,
  paramsOrRawBody: Record<string, string | undefined> | string | undefined
): boolean {
  const validateToggle = "false";
  if (validateToggle === "false") {
    logger.warn("TWILIO_VALIDATE=false — skipping Twilio signature verification (DEV ONLY).");
    return true;
  }

  if (!config.twilioAuthToken) {
    logger.warn("Twilio Auth Token not configured — cannot validate signature. (Failing closed)");
    return false;
  }
  if (!signature) return false;

  const finalUrl = trimTrailingSlash(fullUrl);
  try {
    const ok = validateRequest(
      config.twilioAuthToken,
      signature,
      finalUrl,
      // Twilio signs x-www-form-urlencoded params, so pass the parsed form object.
      typeof paramsOrRawBody === "string" ? {} : (paramsOrRawBody as any)
    );

    if (!ok) {
      logger.error(
        {
          reason: "signature_mismatch",
          url_used: finalUrl,
          have_signature: signature,
          keys: typeof paramsOrRawBody === "string" ? "raw" : Object.keys(paramsOrRawBody || {}),
        },
        "Twilio signature validation failed"
      );
    }
    return ok;
  } catch (e) {
    logger.error({ err: e, url_used: finalUrl }, "Error validating Twilio signature");
    return false;
  }
}


export async function sendWhatsAppText(client: Twilio, fromNum: string, toNum: string, body: string) {
  await client.messages.create({ body, from: fromNum, to: `whatsapp:${toNum}` });
}

export async function sendWhatsAppMedia(client: Twilio, fromNum: string, toNum: string, mediaUrl: string, body?: string) {
  await client.messages.create({ body, mediaUrl: [mediaUrl], from: `whatsapp:${fromNum}`, to: `whatsapp:${toNum}` });
}
