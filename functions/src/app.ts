import express from "express";
import pinoHttp from "pino-http";
import { webhookHandler } from "./controllers/webhookController";
import { logger } from "./logger";

export const app = express();

// IMPORTANT: urlencoded parser FIRST, with verify hook to capture raw body
app.use(
  express.urlencoded({
    extended: true,
    verify: (req: any, _res, buf) => {
      // Save raw body for signature debugging / JSON cases
      req.rawBody = buf?.toString("utf8");
    },
  })
);

// JSON parser can coexist, Twilio sends form-encoded for WhatsApp messages
app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf?.toString("utf8");
    },
  })
);

app.use(pinoHttp({ logger }));

app.get("/health", (_req, res) => res.status(200).json({ ok: true }));

// Webhook endpoints
app.post("/", webhookHandler);
app.post("/webhook", webhookHandler);
