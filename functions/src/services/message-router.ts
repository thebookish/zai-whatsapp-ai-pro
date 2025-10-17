
import { transcribeTwilioAudio } from "../adapters/speech";
import { generateWithRAG } from "./rag";
import { synthesizeAndStore } from "../adapters/tts";
import { sendWhatsAppMedia, sendWhatsAppText, getTwilioClient } from "../adapters/twilio";

export async function handleInboundMessage(payload: {
  from: string;
  to: string;
  body?: string;
  mediaUrl?: string;
  mediaContentType?: string;
  userId: string;
}) {
  const { from, to, body, mediaUrl, mediaContentType, userId } = payload;
  const twilio = getTwilioClient();

  let query = body || "";
  const isAudio = !!mediaUrl && (mediaContentType || "").includes("audio");

  if (isAudio && mediaUrl) {
  const text = await transcribeTwilioAudio(mediaUrl);
  console.log("Voice transcription:", text);
  }

  const answer = await generateWithRAG(query, userId);

  if (isAudio) {
    const publicUrl = await synthesizeAndStore(answer, `${userId}_${Date.now()}.mp3`);
    await sendWhatsAppMedia(twilio, to, from, publicUrl);
  } else {
    await sendWhatsAppText(twilio, to, from, answer);
  }
}
