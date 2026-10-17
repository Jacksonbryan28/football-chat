import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';

// The one place that decides which AI model the app talks to.
// To switch providers, change MODEL_PROVIDER / MODEL_NAME in .env and add a
// case below (e.g. install @ai-sdk/anthropic and return anthropic(name)).

const DEFAULT_PROVIDER = 'google';
const DEFAULT_MODEL = 'gemini-3.8-flash';
const PLACEHOLDER = 'paste-your-key-here';

function requireKey(name: string): string {
  const key = import.meta.env[name];
  if (!key || key === PLACEHOLDER) {
    throw new Error(`${name} is missing. Add your key to .env (see .env.example).`);
  }
  return key;
}

export function getModelInfo() {
  return {
    provider: import.meta.env.MODEL_PROVIDER || DEFAULT_PROVIDER,
    name: import.meta.env.MODEL_NAME || DEFAULT_MODEL,
  };
}

export function getModel(): LanguageModel {
  const { provider, name } = getModelInfo();

  switch (provider) {
    case 'google': {
      const google = createGoogleGenerativeAI({
        apiKey: requireKey('GOOGLE_GENERATIVE_AI_API_KEY'),
      });
      return google(name);
    }
    default:
      throw new Error(`Unknown MODEL_PROVIDER "${provider}". Supported: google`);
  }
}
