import OpenAI, { toFile } from 'openai';
import type { Page, Locator } from 'playwright';
import type { AppConfig } from '../types.js';
import type { Logger } from '../utils/logger.js';

let groqClient: OpenAI | null = null;

function getGroqClient(apiKey: string): OpenAI {
  groqClient ??= new OpenAI({
    apiKey,
    baseURL: 'https://api.groq.com/openai/v1',
  });
  return groqClient;
}

/**
 * Find and transcribe audio from <audio> or <video> elements.
 * Searches in the container first, then page-wide near the quiz.
 */
export async function transcribeAudioFromElement(
  page: Page,
  container: Locator,
  config: AppConfig,
  logger: Logger,
): Promise<string | null> {
  if (!config.groqApiKey) return null;

  // Check for audio AND video sources in container
  const mediaSelector = 'audio source[src], audio[src], video source[src], video[src]';
  const media = container.locator(mediaSelector);

  if (await media.count() === 0) {
    // Check page-wide near quiz
    const pageMedia = page.locator(`#quiz ${mediaSelector}`);
    if (await pageMedia.count() === 0) return null;
    return transcribeFromLocator(page, pageMedia.first(), config, logger);
  }

  return transcribeFromLocator(page, media.first(), config, logger);
}

async function transcribeFromLocator(
  page: Page,
  mediaLocator: Locator,
  config: AppConfig,
  logger: Logger,
): Promise<string | null> {
  const src = await mediaLocator.getAttribute('src');
  if (!src) return null;

  logger.info(`Transcribing (Whisper): ${src.slice(0, 80)}...`);

  try {
    const fullUrl = src.startsWith('http') ? src : `https://esaip.gofluent.com${src}`;
    const response = await page.request.get(fullUrl);
    const buffer = Buffer.from(await response.body());

    // Groq Whisper has a 25MB limit
    if (buffer.length > 25 * 1024 * 1024) {
      logger.warn(`Media too large (${(buffer.length / 1024 / 1024).toFixed(1)}MB), skipping transcription`);
      return null;
    }

    const groq = getGroqClient(config.groqApiKey!);
    const ext = src.includes('.mp4') || src.includes('video') ? 'mp4' : 'mp3';
    const mime = ext === 'mp4' ? 'video/mp4' : 'audio/mpeg';
    const file = await toFile(buffer, `media.${ext}`, { type: mime });

    const transcription = await groq.audio.transcriptions.create({
      file,
      model: config.whisperModel,
      language: 'en',
    });

    const transcript = transcription.text.trim();
    if (transcript) {
      logger.success(`Whisper: "${transcript.slice(0, 120)}"`);
    }
    return transcript || null;
  } catch (e) {
    logger.error(`Whisper failed: ${e}`);
    return null;
  }
}
