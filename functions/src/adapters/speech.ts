import { SpeechClient } from "@google-cloud/speech";
import fetch from "node-fetch";

const speech = new SpeechClient();

/**
 * Download an audio file from Twilio and transcribe it using Google Speech-to-Text.
 * Works with Twilio WhatsApp voice messages (.ogg format).
 */
export async function transcribeTwilioAudio(twilioUrl: string): Promise<string> {
  try {
    // Download the Twilio media
    const resp = await fetch(twilioUrl, {
      headers: {
        // Must authenticate using Twilio Account SID + Auth Token (for private URLs)
        Authorization:
          "Basic " +
          Buffer.from(
            `${process.env.TWILIO_SID}:${process.env.TWILIO_AUTH_TOKEN}`
          ).toString("base64"),
      },
    });
    if (!resp.ok) throw new Error(`Failed to fetch audio: ${resp.status}`);
    const audioBuffer = Buffer.from(await resp.arrayBuffer());

    // Send to Google Speech as binary content
    const [result] = await speech.recognize({
      audio: { content: audioBuffer.toString("base64") },
      config: {
        encoding: "OGG_OPUS", // WhatsApp voice notes are usually .ogg
        sampleRateHertz: 48000,
        languageCode: "en-US",
        model: "default",
      },
    });

    const transcription =
      result.results?.map((r) => r.alternatives?.[0]?.transcript).join(" ") ||
      "";
    return transcription.trim();
  } catch (err) {
    console.error("Speech-to-Text error:", err);
    return "";
  }
}
