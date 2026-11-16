import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parse } from 'yaml';

import {
  allSections,
  catalogSetToYaml,
  deckToCatalogSet,
  parseCatalogSet,
  parseCatalogText,
  sectionLabel,
  suggestDeckName,
} from '../catalog';
import { catalogFileName } from '../share-file';

const BIOLOGY_YAML = readFileSync(join(__dirname, '../../../docs/catalog/biology-7-pasechnik.yaml'), 'utf8');
const biologySet = () => parseCatalogText(BIOLOGY_YAML);
/** Тот же набор в виде объекта — как будто JSON-файл. */
const biology = () => JSON.parse(JSON.stringify(parse(BIOLOGY_YAML)));

const SIMPLE = `
title: Алгебра. 7 класс
chapters:
  - title: Глава 1. Выражения
    sections:
      - title: Тождества
        cards:
          Тождество: Равенство, верное при любых значениях переменных.
          "(a + b)²": "a² + 2ab + b²"
          2³: 8
`;

describe('набор по биологии (docs/catalog)', () => {
  it('биология 7 класс: 5 глав, параграфы 1–26 по порядку', () => {
    const set = biologySet();
    expect(set).toMatchObject({ id: 'biology-7-pasechnik', frontLang: 'ru-RU', backLang: 'ru-RU' });
    expect(set.chapters).toHaveLength(5);
    expect(allSections(set).map((s) => s.number)).toEqual(Array.from({ length: 26 }, (_, i) => i + 1));
    expect(allSections(set).map((s) => s.key)).toEqual(Array.from({ length: 26 }, (_, i) => i + 1));
    for (const section of allSections(set)) expect(section.cards.length).toBeGreaterThanOrEqual(5);
  });

  it('тексты карточек короткие — помещаются на экран раунда', () => {
    for (const card of allSections(biologySet()).flatMap((s) => s.cards)) {
      expect(card.front.length).toBeLessThanOrEqual(80);
      expect(card.back.length).toBeLessThanOrEqual(200);
    }
  });

  it('тот же набор в виде JSON разбирается так же', () => {
    expect(parseCatalogSet(biology())).toEqual(biologySet());
  });
});

describe('разбор YAML', () => {
  it('читает минимальный набор: без id, номеров и языков', () => {
    const set = parseCatalogText(SIMPLE);
    expect(set).toMatchObject({ id: 'алгебра. 7 класс', frontLang: 'ru-RU', backLang: 'ru-RU', source: undefined });
    const [section] = allSections(set);
    expect(section).toMatchObject({ key: 1, number: undefined, title: 'Тождества' });
    expect(sectionLabel(section)).toBe('Тождества');
    expect(section.cards).toEqual([
      { front: 'Тождество', back: 'Равенство, верное при любых значениях переменных.' },
      { front: '(a + b)²', back: 'a² + 2ab + b²' },
      { front: '2³', back: '8' },
    ]);
  });

  it('понимает языки ru и en', () => {
    const set = parseCatalogText(`${SIMPLE}\nfrontLang: en\nbackLang: RU\n`);
    expect([set.frontLang, set.backLang]).toEqual(['en-US', 'ru-RU']);
    expect(() => parseCatalogText(`${SIMPLE}\nfrontLang: de\n`)).toThrow(/не поддерживается/);
  });

  it('называет строку с ошибкой и подсказывает про двоеточие', () => {
    const broken = SIMPLE.replace('Тождество: Равенство,', 'Тождество: Равенство: это,');
    expect(() => parseCatalogText(broken)).toThrow(/строке 8.*кавычки/);
  });

  it('объясняет, чего не хватает', () => {
    expect(() => parseCatalogText('просто текст')).toThrow(/не похож на набор/);
    expect(() => parseCatalogText('title: X\nchapters: []')).toThrow(/нет глав/);
    expect(() => parseCatalogText('title: X\nchapters:\n  - title: Г\n    sections:\n      - title: П\n')).toThrow(
      /«П»: нет карточек/,
    );
    expect(() => parseCatalogText(SIMPLE.replace('2³: 8', '2³: ""'))).toThrow(/«2³»: пусто/);
  });

  it('не принимает повтор термина (YAML) и повтор номера параграфа', () => {
    expect(() => parseCatalogText(`${SIMPLE}          тождество: ещё раз\n`)).toThrow(/строке|повторяется/);

    const copy = biology();
    copy.chapters[0].sections[1].cards = [{ front: 'Систематика', back: 'раз' }, { front: ' систематика ', back: 'ещё раз' }];
    expect(() => parseCatalogSet(copy)).toThrow(/«систематика» повторяется/i);

    const sections = biology();
    sections.chapters[1].sections[0].number = 1;
    expect(() => parseCatalogSet(sections)).toThrow(/§1 повторяется/);
  });

  it('не принимает слишком длинное определение и чужой формат', () => {
    expect(() => parseCatalogText(SIMPLE.replace('2³: 8', `2³: ${'a'.repeat(1001)}`))).toThrow(/длиннее 1000/);
    expect(() => parseCatalogSet({ ...biology(), format: 'other' })).toThrow(/формат/);
    expect(() => parseCatalogSet({ ...biology(), version: 2 })).toThrow(/новой версии/);
  });
});

describe('название стопки', () => {
  it('по одному параграфу, по главе или по набору', () => {
    const set = biologySet();
    expect(suggestDeckName(set, [6])).toBe('§6. Отдел Моховидные');
    expect(suggestDeckName(set, [22, 23, 26])).toBe('Биология: Грибы');
    expect(suggestDeckName(set, [1, 20])).toBe('Биология. 7 класс');
  });
});

describe('экспорт в YAML', () => {
  it('набор по биологии после экспорта загружается обратно без изменений', () => {
    const set = biologySet();
    expect(parseCatalogText(catalogSetToYaml(set))).toEqual(set);
  });

  it('набор без номеров и с английским тоже переживает экспорт', () => {
    const set = parseCatalogText(`${SIMPLE}\nfrontLang: en\nsource: "Тетрадь: слова"\n`);
    const yaml = catalogSetToYaml(set);
    expect(yaml).toContain('frontLang: en');
    expect(yaml).not.toContain('number');
    expect(parseCatalogText(yaml)).toEqual(set);
  });

  it('стопка превращается в набор, повторяющиеся термины нумеруются', () => {
    const set = deckToCatalogSet({ name: 'Мои слова: осень', front_lang: 'en-US', back_lang: 'ru-RU' }, [
      { front: 'leaf', back: 'лист' },
      { front: 'Leaf', back: 'листок' },
      { front: 'rain', back: 'дождь' },
    ]);
    expect(set.id).toBe('мои слова- осень');
    expect(allSections(set)[0].cards.map((c) => c.front)).toEqual(['leaf', 'Leaf (2)', 'rain']);
    expect(parseCatalogText(catalogSetToYaml(set))).toEqual(set);
  });

  it('имя файла без запрещённых знаков', () => {
    expect(catalogFileName({ ...biologySet(), title: 'Био: 7/8 "класс"' })).toBe('Био 7 8 класс.yaml');
  });
});
