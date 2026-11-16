import { allSections, CATALOG, getCatalogSet, parseCatalogSet, suggestDeckName } from '../catalog';
import biology from '../sets/biology-7-pasechnik.json';

describe('готовые наборы', () => {
  it('все наборы проходят проверку и имеют разные id', () => {
    expect(CATALOG.length).toBeGreaterThan(0);
    expect(new Set(CATALOG.map((set) => set.id)).size).toBe(CATALOG.length);
  });

  it('биология 7 класс: 5 глав, параграфы 1–26 по порядку', () => {
    const set = getCatalogSet('biology-7-pasechnik')!;
    expect(set.chapters).toHaveLength(5);
    expect(allSections(set).map((s) => s.number)).toEqual(Array.from({ length: 26 }, (_, i) => i + 1));
    for (const section of allSections(set)) expect(section.cards.length).toBeGreaterThanOrEqual(5);
  });

  it('тексты карточек не слишком длинные для экрана раунда', () => {
    for (const set of CATALOG) {
      for (const card of allSections(set).flatMap((s) => s.cards)) {
        expect(card.front.length).toBeLessThanOrEqual(80);
        expect(card.back.length).toBeLessThanOrEqual(200);
      }
    }
  });

  it('не принимает повтор термина и повтор параграфа', () => {
    const copy = JSON.parse(JSON.stringify(biology));
    copy.chapters[0].sections[1].cards.push({ front: ' систематика ', back: 'ещё раз' });
    expect(() => parseCatalogSet(copy)).toThrow(/повторяется/);

    const sections = JSON.parse(JSON.stringify(biology));
    sections.chapters[1].sections[0].number = 1;
    expect(() => parseCatalogSet(sections)).toThrow(/§1 повторяется/);
  });

  it('не принимает пустую карточку и чужой формат', () => {
    const copy = JSON.parse(JSON.stringify(biology));
    copy.chapters[0].sections[0].cards[0].back = '  ';
    expect(() => parseCatalogSet(copy)).toThrow(/пустая карточка/);
    expect(() => parseCatalogSet({ ...biology, format: 'other' })).toThrow(/формат/);
  });

  it('предлагает название стопки по выбору', () => {
    const set = getCatalogSet('biology-7-pasechnik')!;
    expect(suggestDeckName(set, [6])).toBe('§6. Отдел Моховидные');
    expect(suggestDeckName(set, [22, 23, 26])).toBe('Биология: Грибы');
    expect(suggestDeckName(set, [1, 20])).toBe('Биология. 7 класс');
  });
});
