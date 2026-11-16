import { DEFAULT_LANGUAGE, LANGUAGES } from '@/constants/languages';

import type { Db } from './db';

export interface Settings {
  /** Секунд на ответ; 0 — таймер выключен. */
  timerSeconds: number;
  /** Карточек в раунде. */
  roundSize: number;
  /** Язык, который подставляется в новые стопки для обеих сторон карточки. */
  defaultLanguage: string;
}

export const DEFAULT_SETTINGS: Settings = {
  timerSeconds: 30,
  roundSize: 10,
  defaultLanguage: DEFAULT_LANGUAGE,
};

export const TIMER_OPTIONS = [0, 15, 30, 45, 60] as const;
export const ROUND_SIZE_OPTIONS = [5, 10, 15, 20] as const;

const ALLOWED: { [K in keyof Settings]: readonly Settings[K][] } = {
  timerSeconds: TIMER_OPTIONS,
  roundSize: ROUND_SIZE_OPTIONS,
  defaultLanguage: LANGUAGES.map((lang) => lang.code),
};

/** Значение из базы в нужном типе: числовые настройки хранятся строкой. */
function parse<K extends keyof Settings>(key: K, raw: string): Settings[K] | undefined {
  const value = (typeof DEFAULT_SETTINGS[key] === 'number' ? Number(raw) : raw) as Settings[K];
  return ALLOWED[key].includes(value) ? value : undefined;
}

const isKey = (key: string): key is keyof Settings => key in ALLOWED;

/** Настройки из базы; отсутствующие и испорченные значения заменяются значениями по умолчанию. */
export async function getSettings(db: Db): Promise<Settings> {
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    `SELECT key, value FROM settings`,
    [],
  );
  const settings: Settings = { ...DEFAULT_SETTINGS };
  for (const { key, value } of rows) {
    if (!isKey(key)) continue;
    const parsed = parse(key, value);
    if (parsed !== undefined) (settings as unknown as Record<string, unknown>)[key] = parsed;
  }
  return settings;
}

export async function setSetting<K extends keyof Settings>(
  db: Db,
  key: K,
  value: Settings[K],
  now = Date.now(),
): Promise<void> {
  if (!ALLOWED[key].includes(value)) throw new Error(`Недопустимое значение настройки ${key}: ${value}`);
  await db.runAsync(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, String(value), now],
  );
}
