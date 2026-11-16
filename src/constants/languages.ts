export interface Language {
  /** Код BCP 47 для распознавания речи. */
  code: string;
  label: string;
  short: string;
}

export const LANGUAGES: readonly Language[] = [
  { code: 'ru-RU', label: 'Русский', short: 'RU' },
  { code: 'en-US', label: 'Английский', short: 'EN' },
  { code: 'de-DE', label: 'Немецкий', short: 'DE' },
  { code: 'fr-FR', label: 'Французский', short: 'FR' },
  { code: 'es-ES', label: 'Испанский', short: 'ES' },
];

export const DEFAULT_LANGUAGE = LANGUAGES[0].code;

export function languageShort(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.short ?? code.slice(0, 2).toUpperCase();
}

export function nextLanguage(code: string): string {
  const index = LANGUAGES.findIndex((l) => l.code === code);
  return LANGUAGES[(index + 1) % LANGUAGES.length].code;
}
