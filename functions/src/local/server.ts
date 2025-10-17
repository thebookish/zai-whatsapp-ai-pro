
import express from "express";
import pinoHttp from "pino-http";
import { webhookHandler } from "../controllers/webhookController";
import dotenv from "dotenv";
import { logger } from "../logger";

dotenv.config();

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(pinoHttp({ logger }));

app.get("/health", (_req, res) => res.json({ ok: true }));
app.post("/", webhookHandler);
app.post("/webhook", webhookHandler);

const port = parseInt(process.env.PORT || "8787", 10);
app.listen(port, () => logger.info({ port }, "Local webhook server running"));
