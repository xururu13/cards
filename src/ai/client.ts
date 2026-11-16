import type { AiConfig } from './config';

export class AiError extends Error {}

type Part = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };
export interface ChatMessage {
  role: 'system' | 'user';
  content: string | Part[];
}

const TIMEOUT_MS = 60_000;

function errorFor(status: number, body: string): AiError {
  if (status === 401 || status === 403) return new AiError('Модель не приняла ключ доступа. Проверь ключ.');
  if (status === 404) return new AiError('Модель не найдена. Проверь адрес и название модели.');
  if (status === 413) return new AiError('Фото слишком большое для модели.');
  if (status === 429) return new AiError('Слишком много запросов к модели. Подожди минуту и попробуй снова.');
  if (status === 400 && /image|vision|multimodal|modalit/i.test(body)) {
    return new AiError('Модель не умеет читать изображения. Нужна модель с поддержкой картинок.');
  }
  return new AiError(`Модель ответила ошибкой ${status}.`);
}

/** Убирает рассуждения Qwen (<think>…</think>) и обёртку ```…```, если модель её добавила. */
export function cleanReply(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/^\s*```[a-z]*\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
}

/** Достаёт первый JSON-объект из ответа модели. */
export function parseJsonReply<T>(text: string): T {
  const cleaned = cleanReply(text);
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end < start) throw new AiError('Модель ответила не в том формате. Попробуй ещё раз.');
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  } catch {
    throw new AiError('Модель ответила не в том формате. Попробуй ещё раз.');
  }
}

/** Один запрос к OpenAI-совместимому /chat/completions. Возвращает текст ответа. */
export async function chat(
  config: AiConfig,
  messages: ChatMessage[],
  fetchImpl: typeof fetch = fetch,
  { timeoutMs = TIMEOUT_MS, temperature = 0 }: { timeoutMs?: number; temperature?: number } = {},
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify({ model: config.model, messages, temperature, max_tokens: 2000 }),
      signal: controller.signal,
    });
  } catch {
    throw new AiError(
      controller.signal.aborted
        ? 'Модель не ответила за минуту. Попробуй ещё раз.'
        : 'Нет связи с моделью. Проверь интернет.',
    );
  } finally {
    clearTimeout(timer);
  }
  const body = await response.text();
  if (!response.ok) throw errorFor(response.status, body);
  let text: unknown;
  try {
    text = JSON.parse(body).choices?.[0]?.message?.content;
  } catch {
    text = undefined;
  }
  if (typeof text !== 'string') throw new AiError('Модель вернула пустой ответ.');
  return text;
}
