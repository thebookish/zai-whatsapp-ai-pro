
import { TextToSpeechClient } from "@google-cloud/text-to-speech";
import { Storage } from "@google-cloud/storage";
import { config } from "../config";

const ttsClient = new TextToSpeechClient();
const storage = new Storage();

export async function synthesizeAndStore(text: string, filename: string): Promise<string> {
  const [out] = await ttsClient.synthesizeSpeech({
    input: { text },
    voice: { languageCode: "en-US", ssmlGender: "NEUTRAL" },
    audioConfig: { audioEncoding: "MP3" }
  });

  const bucket = storage.bucket(config.voiceBucket);
  const file = bucket.file(filename);
  await file.save(out.audioContent as Buffer, { contentType: "audio/mpeg" });
  await file.makePublic();
  return file.publicUrl();
}
