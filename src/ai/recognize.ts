import { LANGUAGES } from '@/constants/languages';

import { chat, parseJsonReply, AiError } from './client';
import type { AiConfig } from './config';

const PROMPT = (language: string) =>
  `На фото — страница учебника, тетради или словаря. Распознай весь читаемый текст ` +
  `(скорее всего на языке: ${language}; может встречаться и другой язык). ` +
  `Сохраняй порядок строк, исправляй разрывы переносов, не переводи и не добавляй ничего от себя. ` +
  `Ответь только JSON без пояснений: {"lines": ["первая строка", "вторая строка"]}. ` +
  `Если текста нет, ответь {"lines": []}.`;

/** Распознаёт текст на фото и возвращает строки в порядке чтения. */
export async function recognizeText(
  config: AiConfig,
  imageBase64: string,
  languageCode: string,
  fetchImpl?: typeof fetch,
): Promise<string[]> {
  const language = LANGUAGES.find((l) => l.code === languageCode)?.label.toLowerCase() ?? languageCode;
  const reply = await chat(
    config,
    [
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
          { type: 'text', text: PROMPT(language) },
        ],
      },
    ],
    fetchImpl,
  );
  const { lines } = parseJsonReply<{ lines?: unknown }>(reply);
  if (!Array.isArray(lines)) throw new AiError('Модель ответила не в том формате. Попробуй ещё раз.');
  return lines
    .filter((line): line is string => typeof line === 'string')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}
