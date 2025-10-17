import { Request, Response } from "express";
import { sendJson } from "../utils/http";
import { UnauthorizedError } from "../utils/errors";
import { validateTwilioSignature } from "../adapters/twilio";
import { findProUserByPhone } from "../adapters/firestore";
import { handleInboundMessage } from "../services/message-router";
import { handleOnboardingStep } from "../services/onboarding";
import { logger } from "../logger";

function buildRequestUrlForSignature(req: Request): string {
  // Prefer EXTERNAL_URL (your ngrok https URL), no trailing slash
  const external = (process.env.EXTERNAL_URL || "").replace(/\/+$/, ""); // trim trailing /
  if (external) {
    // include exact path + query
    return `${external}${req.originalUrl}`;
  }

  // Fallback: derive from forwarded headers (proxies) or express
  const proto = (req.get("x-forwarded-proto") || req.protocol || "https")
    .split(",")[0]
    .trim();
  const host = (req.get("x-forwarded-host") || req.get("host") || "")
    .split(",")[0]
    .trim();
  return `${proto}://${host}${req.originalUrl}`;
}

export async function webhookHandler(req: Request, res: Response) {
  try {
    const signature = req.headers["x-twilio-signature"] as string | undefined;
    const fullUrl = buildRequestUrlForSignature(req);

    // IMPORTANT: pass the parsed form params object (req.body) for WhatsApp
    const ok = validateTwilioSignature(signature, fullUrl, req.body);
    if (!ok) throw new UnauthorizedError("Invalid Twilio signature");

    const from = (req.body.From || "").replace("whatsapp:", "");
    const to = (req.body.To || "").replace("whatsapp:", "");
    const body: string | undefined = req.body.Body;
    const mediaUrl: string | undefined = req.body.MediaUrl0;
    const mediaContentType: string | undefined = req.body.MediaContentType0;

    if (!from || !to) throw new UnauthorizedError("Missing From/To");

    const user = await findProUserByPhone(from);
    if (!user) {
      const step = await handleOnboardingStep(from, body || "");
      const { sendWhatsAppText, getTwilioClient } = await import("../adapters/twilio");
      const twilio = getTwilioClient();
      await sendWhatsAppText(twilio, to, from, step.message);
      return sendJson(res, 200, { ok: true, onboarding: true, done: step.done });
    }

    await handleInboundMessage({ from, to, body, mediaUrl, mediaContentType, userId: user.id });
    return sendJson(res, 200, { ok: true });
  } catch (err: any) {
    logger.error({ err }, "webhook error");
    const status = err?.name === "UnauthorizedError" ? 401 : 500;
    return sendJson(res, status, { error: err?.message || "Internal Server Error" });
  }
}
