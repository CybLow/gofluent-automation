import type { AppConfig, AIProvider } from './types.js';

function env(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function buildAIProviders(): AIProvider[] {
  const providers: AIProvider[] = [];

  // OpenRouter (primary — paid, reliable)
  if (process.env['OPENROUTER_API_KEY']) {
    providers.push({
      name: 'OpenRouter',
      apiKey: process.env['OPENROUTER_API_KEY'],
      baseUrl: process.env['OPENROUTER_BASE_URL'] || 'https://openrouter.ai/api/v1',
      model: process.env['OPENROUTER_MODEL'] || 'google/gemini-2.0-flash-001',
    });
  }

  // Groq (fallback — free, fast, rate-limited)
  if (process.env['GROQ_API_KEY']) {
    providers.push({
      name: 'Groq',
      apiKey: process.env['GROQ_API_KEY'],
      baseUrl: 'https://api.groq.com/openai/v1',
      model: process.env['GROQ_MODEL'] || 'llama-3.3-70b-versatile',
    });
  }

  // OpenAI (fallback — paid)
  if (process.env['OPENAI_API_KEY']) {
    providers.push({
      name: 'OpenAI',
      apiKey: process.env['OPENAI_API_KEY'],
      baseUrl: 'https://api.openai.com/v1',
      model: process.env['OPENAI_MODEL'] || 'gpt-4o',
    });
  }

  if (providers.length === 0) {
    throw new Error('No AI provider configured. Set at least OPENROUTER_API_KEY or GROQ_API_KEY in .env');
  }

  return providers;
}

export function loadConfig(profile?: string): AppConfig {
  const suffix = profile ? `__${profile.toUpperCase()}` : '';

  return {
    gofluentUsername: env(`GOFLUENT_USERNAME${suffix}`),
    gofluentPassword: env(`GOFLUENT_PASSWORD${suffix}`),
    gofluentDomain: env('GOFLUENT_DOMAIN', 'esaip'),
    googleAiApiKey: process.env['GOOGLE_AI_API_KEY'] || '',
    groqApiKey: process.env['GROQ_API_KEY'] || undefined,
    aiProviders: buildAIProviders(),
    whisperModel: process.env['WHISPER_MODEL'] || 'whisper-large-v3',
  };
}
