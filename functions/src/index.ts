
import * as functions from "firebase-functions";
import { app } from "./app";

// Export the HTTPS Function (wraps Express app)
export const zaiWebhook = functions.region("europe-west1").https.onRequest(app);
