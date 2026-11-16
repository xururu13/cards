import { LANGUAGES } from '@/constants/languages';

import { AiError, chat, cleanReply } from './client';
import type { AiConfig } from './config';

/** Готовые подсказки: что написать на обороте. */
export const PRESETS = [
  { label: 'Перевод', instruction: 'Только перевод, одно-три слова.' },
  { label: 'Перевод и пример', instruction: 'Перевод и короткий пример употребления в предложении.' },
  { label: 'Определение', instruction: 'Короткое понятное определение в одно-два предложения.' },
  { label: 'Формула', instruction: 'Формулу или правило и одно пояснение.' },
] as const;

export interface GenerateInput {
  /** Слово или термин с лицевой стороны. */
  front: string;
  /** Название стопки — подсказка о предмете: «Биология», «Английский язык». */
  deckName: string;
  /** Язык оборота. */
  backLanguage: string;
  /** Что именно написать — своими словами или из готовых подсказок. */
  instruction: string;
  /** Другой вариант ответа: модель отвечает менее предсказуемо. */
  variation?: boolean;
}

const MAX_LENGTH = 1000;

/** Генерирует текст для оборота карточки. Возвращает простой текст без разметки. */
export async function generateBack(
  config: AiConfig,
  { front, deckName, backLanguage, instruction, variation }: GenerateInput,
  fetchImpl?: typeof fetch,
): Promise<string> {
  const term = front.trim();
  if (!term) throw new AiError('Сначала заполни сторону со словом.');
  const language =
    LANGUAGES.find((l) => l.code === backLanguage)?.label.toLowerCase() ?? backLanguage;

  const reply = await chat(
    config,
    [
      {
        role: 'system',
        content:
          'Ты помогаешь школьнику делать карточки для запоминания. Пиши точно, коротко и понятно ' +
          'для ученика средней школы. Отвечай только текстом для оборота карточки: без вступлений, ' +
          'без markdown, без кавычек вокруг ответа. Степени и индексы пиши символами Unicode (x², H₂O). ' +
          'Если термин неизвестен или в нём опечатка, так и напиши одной фразой.',
      },
      {
        role: 'user',
        content:
          `Предмет: ${deckName}.\nНа лицевой стороне карточки: «${term}».\n` +
          `Язык оборота: ${language}.\nЧто написать на обороте: ${instruction.trim() || PRESETS[0].instruction}`,
      },
    ],
    fetchImpl,
    { temperature: variation ? 0.8 : 0 },
  );

  const text = cleanReply(reply)
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/^#+\s*/gm, '')
    .replace(/^["«](.*)["»]$/s, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!text) throw new AiError('Модель вернула пустой ответ. Попробуй ещё раз.');
  return text.length > MAX_LENGTH ? `${text.slice(0, MAX_LENGTH - 1)}…` : text;
}
