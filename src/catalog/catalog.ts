/**
 * Наборы карточек по учебникам. В приложение не встроены: пользователь загружает их
 * из YAML-файла. Формат файла описан в docs/catalog-format.md.
 */
import { parse, stringify, YAMLParseError } from 'yaml';

import { DEFAULT_LANGUAGE, LANGUAGES } from '@/constants/languages';

export interface CatalogCard {
  front: string;
  back: string;
}

export interface CatalogSection {
  /** Порядковый номер параграфа в наборе, начиная с 1. По нему выбирают параграфы на экране. */
  key: number;
  /** Номер параграфа в учебнике, если он есть. */
  number?: number;
  title: string;
  cards: CatalogCard[];
}

export interface CatalogChapter {
  title: string;
  sections: CatalogSection[];
}

export interface CatalogSet {
  /** Постоянный идентификатор набора: из него строятся id карточек. */
  id: string;
  title: string;
  source?: string;
  frontLang: string;
  backLang: string;
  chapters: CatalogChapter[];
}

export const MAX_FRONT = 200;
export const MAX_BACK = 1000;

export class CatalogError extends Error {}

const fail = (message: string): never => {
  throw new CatalogError(message);
};

type Raw = Record<string, unknown>;
const isObject = (value: unknown): value is Raw =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function text(value: unknown, where: string): string {
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value !== 'string' || !value.trim()) fail(`${where}: пусто`);
  return (value as string).trim();
}

function optionalText(value: unknown, where: string): string | undefined {
  return value === undefined || value === null ? undefined : text(value, where);
}

/** Язык диктовки: ru, en или полный код из LANGUAGES. По умолчанию русский. */
function language(value: unknown, field: string): string {
  const code = optionalText(value, field);
  if (code === undefined) return DEFAULT_LANGUAGE;
  const found = LANGUAGES.find(
    (l) => l.code.toLowerCase() === code.toLowerCase() || l.short.toLowerCase() === code.toLowerCase(),
  );
  if (!found) fail(`${field}: язык «${code}» не поддерживается, можно ${LANGUAGES.map((l) => l.short.toLowerCase()).join(' или ')}`);
  return found!.code;
}

/** Карточки — словарь «термин: определение» или список {front, back}. */
function parseCards(raw: unknown, where: string): CatalogCard[] {
  const pairs: [unknown, unknown][] = Array.isArray(raw)
    ? raw.map((item) => (isObject(item) ? [item.front, item.back] : fail(`${where}: карточка должна быть парой «термин: определение»`)))
    : isObject(raw)
      ? Object.entries(raw)
      : fail(`${where}: нет карточек (cards)`);
  if (pairs.length === 0) fail(`${where}: нет карточек (cards)`);
  return pairs.map(([front, back]) => {
    const card = { front: text(front, `${where}, термин`), back: text(back, `${where}, «${String(front)}»`) };
    if (card.front.length > MAX_FRONT) fail(`${where}: термин «${card.front.slice(0, 30)}…» длиннее ${MAX_FRONT} знаков`);
    if (card.back.length > MAX_BACK) fail(`${where}: определение «${card.front}» длиннее ${MAX_BACK} знаков`);
    return card;
  });
}

/** Ключ карточки внутри набора. Тот же термин при повторной загрузке даёт тот же ключ. */
export function cardKey(front: string): string {
  return front.trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');
}

/** Проверяет набор и приводит к единому виду. Ошибки — понятным текстом для пользователя. */
export function parseCatalogSet(raw: unknown): CatalogSet {
  if (!isObject(raw)) fail('Файл не похож на набор карточек: нужны поля title и chapters.');
  const set = raw as Raw;
  if (set.format !== undefined && set.format !== 'kartochki-catalog') fail('Неизвестный формат файла.');
  if (set.version !== undefined && set.version !== 1) fail('Файл сделан для более новой версии приложения.');

  const title = text(set.title, 'Название набора (title)');
  const id = (optionalText(set.id, 'id') ?? cardKey(title)).replace(/:/g, '-');
  if (!Array.isArray(set.chapters) || set.chapters.length === 0) fail('В наборе нет глав (chapters).');

  const numbers = new Set<number>();
  const fronts = new Set<string>();
  let key = 0;
  const chapters = (set.chapters as unknown[]).map((rawChapter, i): CatalogChapter => {
    if (!isObject(rawChapter)) fail(`Глава ${i + 1}: нужны title и sections`);
    const chapter = rawChapter as Raw;
    const chapterTitle = text(chapter.title, `Глава ${i + 1}, название`);
    if (!Array.isArray(chapter.sections) || chapter.sections.length === 0) {
      fail(`«${chapterTitle}»: нет параграфов (sections)`);
    }
    const sections = (chapter.sections as unknown[]).map((rawSection, j): CatalogSection => {
      if (!isObject(rawSection)) fail(`«${chapterTitle}», параграф ${j + 1}: нужны title и cards`);
      const section = rawSection as Raw;
      const sectionTitle = text(section.title, `«${chapterTitle}», параграф ${j + 1}, название`);
      let number: number | undefined;
      if (section.number !== undefined && section.number !== null) {
        if (!Number.isInteger(section.number) || (section.number as number) < 0) {
          fail(`«${sectionTitle}»: номер параграфа должен быть целым числом`);
        }
        number = section.number as number;
        if (numbers.has(number)) fail(`Параграф §${number} повторяется`);
        numbers.add(number);
      }
      const cards = parseCards(section.cards, number === undefined ? `«${sectionTitle}»` : `§${number}`);
      for (const card of cards) {
        const k = cardKey(card.front);
        if (fronts.has(k)) fail(`Термин «${card.front}» повторяется`);
        fronts.add(k);
      }
      return { key: ++key, number, title: sectionTitle, cards };
    });
    return { title: chapterTitle, sections };
  });

  return {
    id,
    title,
    source: optionalText(set.source, 'source'),
    frontLang: language(set.frontLang, 'frontLang'),
    backLang: language(set.backLang, 'backLang'),
    chapters,
  };
}

/** Разбирает текст файла: YAML (или JSON — он тоже YAML). */
export function parseCatalogText(source: string): CatalogSet {
  let raw: unknown;
  try {
    raw = parse(source);
  } catch (e) {
    const line = e instanceof YAMLParseError ? e.linePos?.[0]?.line : undefined;
    throw new CatalogError(
      `${line ? `Ошибка в строке ${line}` : 'Файл не читается как YAML'}. ` +
        'Проверь отступы (только пробелы) и двоеточия: если в тексте есть «: », возьми его в кавычки.',
    );
  }
  return parseCatalogSet(raw);
}

export function allSections(set: CatalogSet): CatalogSection[] {
  return set.chapters.flatMap((chapter) => chapter.sections);
}

export function countCards(set: CatalogSet): number {
  return allSections(set).reduce((sum, s) => sum + s.cards.length, 0);
}

export function sectionLabel(section: CatalogSection): string {
  return section.number === undefined ? section.title : `§${section.number}. ${section.title}`;
}

const YAML_HEADER =
  '# Набор карточек для приложения «Карточки».\n' +
  '# Загрузить: «Новая стопка» → «Наборы карточек» → «Загрузить из файла».\n\n';

const shortLanguage = (code: string) =>
  (LANGUAGES.find((l) => l.code === code)?.short ?? code).toLowerCase();

/** Набор в виде YAML-файла — того же формата, что принимает «Загрузить из файла». */
export function catalogSetToYaml(set: CatalogSet): string {
  const doc = {
    id: set.id,
    title: set.title,
    ...(set.source ? { source: set.source } : {}),
    frontLang: shortLanguage(set.frontLang),
    backLang: shortLanguage(set.backLang),
    chapters: set.chapters.map((chapter) => ({
      title: chapter.title,
      sections: chapter.sections.map((section) => ({
        ...(section.number === undefined ? {} : { number: section.number }),
        title: section.title,
        cards: Object.fromEntries(section.cards.map((card) => [card.front, card.back])),
      })),
    })),
  };
  return YAML_HEADER + stringify(doc, { lineWidth: 0 });
}

/**
 * Стопка как набор из одной главы и одного параграфа. Повторяющиеся термины получают
 * номер «(2)», иначе файл не загрузится.
 */
export function deckToCatalogSet(
  deck: { name: string; front_lang: string; back_lang: string },
  cards: readonly CatalogCard[],
): CatalogSet {
  const seen = new Map<string, number>();
  const unique = cards.map((card) => {
    const key = cardKey(card.front);
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    return n === 1 ? card : { ...card, front: `${card.front} (${n})` };
  });
  return {
    id: cardKey(deck.name).replace(/:/g, '-'),
    title: deck.name,
    frontLang: deck.front_lang,
    backLang: deck.back_lang,
    chapters: [{ title: deck.name, sections: [{ key: 1, title: deck.name, cards: unique }] }],
  };
}

/** Название стопки по выбранным параграфам: один параграф, одна глава или весь набор. */
export function suggestDeckName(set: CatalogSet, keys: readonly number[]): string {
  const chosen = new Set(keys);
  if (chosen.size === 1) {
    const section = allSections(set).find((s) => chosen.has(s.key));
    if (section) return sectionLabel(section).slice(0, 60);
  }
  const chapters = set.chapters.filter((chapter) => chapter.sections.some((s) => chosen.has(s.key)));
  if (chapters.length === 1) {
    const subject = set.title.split('.')[0];
    return `${subject}: ${chapters[0].title.replace(/^Глава \d+\.\s*/, '')}`.slice(0, 60);
  }
  return set.title.slice(0, 60);
}
