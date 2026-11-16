/** «+15», «−5», «0» — с типографским минусом. */
export const formatDelta = (points: number): string =>
  points > 0 ? `+${points}` : points < 0 ? `−${Math.abs(points)}` : '0';
