/**
 * Готовые наборы карточек по учебникам. Каждый набор — JSON-файл в src/catalog/sets/,
 * формат описан типом CatalogSet. Новый набор: положить файл и добавить его в RAW_SETS.
 */
import biology7Pasechnik from './sets/biology-7-pasechnik.json';

export interface CatalogCard {
  front: string;
  back: string;
}

export interface CatalogSection {
  /** Номер параграфа в учебнике. */
  number: number;
  title: string;
  cards: CatalogCard[];
}

export interface CatalogChapter {
  title: string;
  sections: CatalogSection[];
}

export interface CatalogSet {
  format: 'kartochki-catalog';
  version: 1;
  /** Постоянный идентификатор набора: из него строятся id карточек, менять нельзя. */
  id: string;
  title: string;
  source: string;
  frontLang: string;
  backLang: string;
  chapters: CatalogChapter[];
}

function fail(setId: string, message: string): never {
  throw new Error(`Набор ${setId}: ${message}`);
}

const isText = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';

/** Проверяет набор: обязательные поля, уникальные номера параграфов и термины. */
export function parseCatalogSet(raw: unknown): CatalogSet {
  const set = raw as Partial<CatalogSet> | null;
  const id = typeof set?.id === 'string' ? set.id : '?';
  if (set?.format !== 'kartochki-catalog' || set.version !== 1) fail(id, 'неизвестный формат');
  if (!/^[a-z0-9-]+$/.test(id)) fail(id, 'id — только латиница, цифры и дефис');
  for (const field of ['title', 'source', 'frontLang', 'backLang'] as const) {
    if (!isText(set[field])) fail(id, `нет поля ${field}`);
  }
  if (!Array.isArray(set.chapters) || set.chapters.length === 0) fail(id, 'нет глав');

  const numbers = new Set<number>();
  const fronts = new Set<string>();
  for (const chapter of set.chapters) {
    if (!isText(chapter?.title) || !Array.isArray(chapter.sections)) fail(id, 'глава без названия или параграфов');
    for (const section of chapter.sections) {
      if (!Number.isInteger(section?.number) || !isText(section.title)) fail(id, 'параграф без номера или названия');
      if (numbers.has(section.number)) fail(id, `параграф §${section.number} повторяется`);
      numbers.add(section.number);
      if (!Array.isArray(section.cards) || section.cards.length === 0) fail(id, `§${section.number} без карточек`);
      for (const card of section.cards) {
        if (!isText(card?.front) || !isText(card.back)) fail(id, `пустая карточка в §${section.number}`);
        const key = cardKey(card.front);
        if (fronts.has(key)) fail(id, `термин «${card.front}» повторяется`);
        fronts.add(key);
      }
    }
  }
  return set as CatalogSet;
}

/** Ключ карточки внутри набора. Тот же термин при повторной загрузке даёт тот же ключ. */
export function cardKey(front: string): string {
  return front.trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');
}

export function allSections(set: CatalogSet): CatalogSection[] {
  return set.chapters.flatMap((chapter) => chapter.sections);
}

const RAW_SETS: unknown[] = [biology7Pasechnik];

export const CATALOG: readonly CatalogSet[] = RAW_SETS.map(parseCatalogSet);

export function getCatalogSet(id: string): CatalogSet | undefined {
  return CATALOG.find((set) => set.id === id);
}

/** Название стопки по выбранным параграфам: глава, один параграф или весь предмет. */
export function suggestDeckName(set: CatalogSet, numbers: readonly number[]): string {
  const chosen = new Set(numbers);
  if (chosen.size === 1) {
    const section = allSections(set).find((s) => chosen.has(s.number));
    if (section) return `§${section.number}. ${section.title}`.slice(0, 60);
  }
  const chapters = set.chapters.filter((chapter) => chapter.sections.some((s) => chosen.has(s.number)));
  if (chapters.length === 1) {
    return `${set.title.split('.')[0]}: ${chapters[0].title.replace(/^Глава \d+\.\s*/, '')}`.slice(0, 60);
  }
  return set.title;
}
