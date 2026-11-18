export type AnswerResult = 'correct' | 'wrong' | 'hint' | 'timeout' | 'skipped';

export interface Deck {
  id: string;
  name: string;
  /** Язык диктовки для стороны со словом, например en-US. */
  front_lang: string;
  /** Язык диктовки для оборота. */
  back_lang: string;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

export interface Card {
  id: string;
  deck_id: string;
  front: string;
  back: string;
  /** 0 — не знаю, 4 — знаю твёрдо. */
  level: number;
  correct_count: number;
  wrong_count: number;
  last_shown_at: number | null;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

export interface Round {
  id: string;
  /** null — смешанный раунд по всем стопкам. */
  deck_id: string | null;
  started_at: number;
  finished_at: number | null;
  correct: number;
  wrong: number;
  hints: number;
  score: number;
  updated_at: number;
  deleted_at: number | null;
}

export interface Answer {
  grade: number | null;
  id: string;
  round_id: string;
  card_id: string;
  result: AnswerResult;
  time_ms: number;
  points: number;
  created_at: number;
}
