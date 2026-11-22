export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function overlapMinutes(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const as = toMinutesLocal(aStart);
  const ae = toMinutesLocal(aEnd);
  const bs = toMinutesLocal(bStart);
  const be = toMinutesLocal(bEnd);
  return as < be && bs < ae;
}

function toMinutesLocal(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}
