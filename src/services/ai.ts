import OpenAI from 'openai';
import type { AppConfig, AIProvider, QuestionType } from '../types.js';
import type { Logger } from '../utils/logger.js';

const clientCache = new Map<string, OpenAI>();

const SYSTEM_PROMPT = `You are a polyglot language expert. You will receive data about a language learning activity and must answer quiz questions about it.
You MUST ALWAYS respond as a JSON array of strings.
NEVER respond with anything besides a JSON array of strings.
The response MUST NOT be a JSON object.
If multiple values are part of the response, they MUST be elements of the JSON array.
If you need to complete a sentence, only return the missing part of the sentence that is marked as ____ but keep the result in a JSON array.
Do NOT wrap the response in markdown code blocks.`;

const QUESTION_TYPE_HINTS: Partial<Record<QuestionType, string>> = {
  'fill-gaps-block':
    'This is a fill-in-the-blanks question where you select words from a list. Return the words in the order they fill the blanks. Each value MUST exactly match one of the listed options (case-sensitive).',
  'fill-gaps-text':
    'This is a fill-in-the-blanks question where you type the missing words. Return only the missing word(s), one per blank, in order.',
  'match-text':
    'This is a matching question. Return ONLY the definitions/descriptions in the same order as the words listed. Each value MUST exactly match one of the available options.',
  'scrambled-sentences':
    'This is a sentence completion or word-ordering question. If available options are multi-word phrases, return complete strings, do NOT split. If individual words, return in correct sentence order. Each value MUST exactly match one of the listed options.',
  'scrambled-letters':
    'This is a letter-unscrambling question. Return the complete word as a single string.',
  'multi-choice-text':
    'This is a multiple choice question. Return a single-element array with the text of the correct answer option.',
  'multi-choice-checkbox':
    'This is a multi-select question where MULTIPLE answers can be correct. Return an array with ALL correct answer options. Each value MUST exactly match one of the listed options.',
  'short-text':
    'This is a free-text question. Return a single-element array with your answer.',
};

function getClient(provider: AIProvider): OpenAI {
  if (!clientCache.has(provider.name)) {
    clientCache.set(provider.name, new OpenAI({
      apiKey: provider.apiKey,
      baseURL: provider.baseUrl,
    }));
  }
  return clientCache.get(provider.name)!;
}

export async function getAiAnswer(
  config: AppConfig,
  logger: Logger,
  activityData: string,
  questionText: string,
  questionType: QuestionType,
): Promise<string[]> {
  const typeHint = QUESTION_TYPE_HINTS[questionType] ?? '';
  const userInstruction = typeHint
    ? `${SYSTEM_PROMPT}\n\n${typeHint}`
    : SYSTEM_PROMPT;

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'user', content: userInstruction },
    { role: 'user', content: `The data is the following:\n${activityData}` },
    { role: 'user', content: questionText },
  ];

  for (let p = 0; p < config.aiProviders.length; p++) {
    const provider = config.aiProviders[p];
    const isLast = p === config.aiProviders.length - 1;
    const result = await callProvider(provider, messages, isLast, config, logger, p);
    if (result) return result;
  }

  throw new Error('All AI providers exhausted');
}

async function callProvider(
  provider: AIProvider,
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  isLast: boolean,
  config: AppConfig,
  logger: Logger,
  providerIndex: number,
): Promise<string[] | null> {
  const ai = getClient(provider);

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      logger.debug(`[${provider.name}/${provider.model}] attempt ${attempt}`);

      const response = await ai.chat.completions.create(
        { model: provider.model, messages },
        { timeout: 30_000 },
      );

      const content = response.choices[0]?.message?.content ?? '[]';
      const stripped = stripMarkdownCodeblock(content);
      logger.debug(`AI response: ${stripped.slice(0, 200)}`);

      return parseResponse(stripped);
    } catch (e) {
      const shouldContinue = handleProviderError(e, provider, attempt, isLast, config, logger, providerIndex);
      if (shouldContinue === 'retry') {
        const delay = Math.min(2000 * Math.pow(2, attempt - 1), 15000);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      if (shouldContinue === 'next_provider') return null;
      throw e;
    }
  }
  return null;
}

function parseResponse(stripped: string): string[] {
  try {
    const parsed = JSON.parse(stripped);
    if (Array.isArray(parsed)) return parsed.map(String);
    return [String(parsed)];
  } catch {
    return [stripped.trim()];
  }
}

function handleProviderError(
  e: unknown,
  provider: AIProvider,
  attempt: number,
  isLast: boolean,
  config: AppConfig,
  logger: Logger,
  providerIndex: number,
): 'retry' | 'next_provider' | 'throw' {
  const status = (e as any)?.status;
  const isRetryable = status === 408 || status === 429 || status === 503 || status === 502;

  if (isRetryable && attempt < 3) {
    const delay = Math.min(2000 * Math.pow(2, attempt - 1), 15000);
    logger.warn(`[${provider.name}] ${status}, retry in ${delay}ms (${attempt}/3)`);
    return 'retry';
  }

  if (!isLast) {
    logger.warn(`[${provider.name}] failed, falling back to ${config.aiProviders[providerIndex + 1].name}`);
    return 'next_provider';
  }

  logger.error(`All AI providers failed: ${e}`);
  return 'throw';
}

function stripMarkdownCodeblock(text: string): string {
  return text
    .replace(/^```(?:json)?\s*\n?/, '')
    .replace(/\n?```\s*$/, '')
    .trim();
}
