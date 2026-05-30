import * as Speech from "expo-speech";
import { Audio } from "expo-av";

const TTS_CACHE: Record<string, string> = {};

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();
}

export async function speakNeural(text: string, muted: boolean) {
  if (muted) return;
  const clean = stripHtml(text);

  // If ElevenLabs not configured yet, fall back to expo-speech
  const ELEVENLABS_KEY = "YOUR_ELEVENLABS_KEY";
  const VOICE_ID = "YOUR_VOICE_ID";

  if (
    ELEVENLABS_KEY === "YOUR_ELEVENLABS_KEY" ||
    VOICE_ID === "YOUR_VOICE_ID"
  ) {
    Speech.speak(clean, { language: "en-US", rate: 0.88, pitch: 1.05 });
    return;
  }

  if (TTS_CACHE[clean]) {
    const { sound } = await Audio.Sound.createAsync(
      { uri: TTS_CACHE[clean] },
      { shouldPlay: true }
    );
    await sound.playAsync();
    return;
  }

  try {
    // Stream directly — no file system needed
    const uri =
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}` +
      `?xi-api-key=${ELEVENLABS_KEY}` +
      `&text=${encodeURIComponent(clean)}` +
      `&model_id=eleven_turbo_v2`;

    TTS_CACHE[clean] = uri;

    const { sound } = await Audio.Sound.createAsync(
      { uri },
      { shouldPlay: true }
    );
    await sound.playAsync();
  } catch {
    Speech.speak(clean, { language: "en-US", rate: 0.88, pitch: 1.05 });
  }
}