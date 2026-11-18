import { roundAnswerLanguage, roundSides } from '../direction';

it('в обратном раунде показывает перевод и ждёт ответ на языке слова', () => {
  const card = { front: 'fox', back: 'лиса' };
  const deck = { front_lang: 'en-US', back_lang: 'ru-RU' };
  expect(roundSides(card, 'reverse')).toEqual({ question: 'лиса', answer: 'fox' });
  expect(roundAnswerLanguage(deck, 'reverse')).toBe('en-US');
  expect(roundSides(card, 'forward')).toEqual({ question: 'fox', answer: 'лиса' });
  expect(roundAnswerLanguage(deck, 'forward')).toBe('ru-RU');
});
