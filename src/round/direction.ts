import type { Card, Deck, RoundDirection } from '@/db/types';

export function roundSides(card: Pick<Card, 'front' | 'back'>, direction: RoundDirection) {
  return direction === 'reverse'
    ? { question: card.back, answer: card.front }
    : { question: card.front, answer: card.back };
}

export function roundAnswerLanguage(deck: Pick<Deck, 'front_lang' | 'back_lang'>, direction: RoundDirection) {
  return direction === 'reverse' ? deck.front_lang : deck.back_lang;
}
