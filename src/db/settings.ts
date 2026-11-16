import type { Db } from './db';

export interface Settings {
  /** Секунд на ответ; 0 — таймер выключен. */
  timerSeconds: number;
  /** Карточек в раунде. */
  roundSize: number;
}

export const DEFAULT_SETTINGS: Settings = { timerSeconds: 30, roundSize: 10 };

export const TIMER_OPTIONS = [0, 15, 30, 45, 60] as const;
export const ROUND_SIZE_OPTIONS = [5, 10, 15, 20] as const;

const ALLOWED: Record<keyof Settings, readonly number[]> = {
  timerSeconds: TIMER_OPTIONS,
  roundSize: ROUND_SIZE_OPTIONS,
};

/** Настройки из базы; отсутствующие и испорченные значения заменяются значениями по умолчанию. */
export async function getSettings(db: Db): Promise<Settings> {
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    `SELECT key, value FROM settings`,
    [],
  );
  const settings = { ...DEFAULT_SETTINGS };
  for (const { key, value } of rows) {
    if (key in ALLOWED && ALLOWED[key as keyof Settings].includes(Number(value))) {
      settings[key as keyof Settings] = Number(value);
    }
  }
  return settings;
}

export async function setSetting(
  db: Db,
  key: keyof Settings,
  value: number,
  now = Date.now(),
): Promise<void> {
  if (!ALLOWED[key].includes(value)) throw new Error(`Недопустимое значение настройки ${key}: ${value}`);
  await db.runAsync(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, String(value), now],
  );
}
