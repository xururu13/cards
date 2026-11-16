/**
 * Подключение к модели берётся из переменных окружения сборки (файл .env.local, он не попадает в git).
 * Внимание: значения EXPO_PUBLIC_* встраиваются в приложение, ключ можно достать из APK.
 * Для семейного приложения это допустимо; для публикации ключ нужно спрятать за свой сервер.
 */
export interface AiConfig {
  /** Адрес OpenAI-совместимого API, например https://host/v1 */
  baseUrl: string;
  model: string;
  apiKey: string;
}

export function readAiConfig(env: Record<string, string | undefined> = process.env): AiConfig | null {
  const baseUrl = env.EXPO_PUBLIC_AI_BASE_URL?.trim().replace(/\/+$/, '');
  const model = env.EXPO_PUBLIC_AI_MODEL?.trim();
  const apiKey = env.EXPO_PUBLIC_AI_API_KEY?.trim() ?? '';
  if (!baseUrl || !model) return null;
  return { baseUrl, model, apiKey };
}

// Expo подставляет EXPO_PUBLIC_* только при прямом обращении к process.env.ИМЯ.
export const AI_CONFIG = readAiConfig({
  EXPO_PUBLIC_AI_BASE_URL: process.env.EXPO_PUBLIC_AI_BASE_URL,
  EXPO_PUBLIC_AI_MODEL: process.env.EXPO_PUBLIC_AI_MODEL,
  EXPO_PUBLIC_AI_API_KEY: process.env.EXPO_PUBLIC_AI_API_KEY,
});
