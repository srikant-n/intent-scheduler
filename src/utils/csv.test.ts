import { describe, expect, it } from 'vitest';
import { csvEscape, toCsv } from './csv';

describe('csvEscape', () => {
  it('passes through plain values', () => {
    expect(csvEscape('hello')).toBe('hello');
    expect(csvEscape(42)).toBe('42');
    expect(csvEscape(0)).toBe('0');
  });

  it('returns empty string for null/undefined', () => {
    expect(csvEscape(null)).toBe('');
    expect(csvEscape(undefined)).toBe('');
  });

  it('quotes values containing commas, quotes, or newlines', () => {
    expect(csvEscape('a,b')).toBe('"a,b"');
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"');
    expect(csvEscape('line1\r\nline2')).toBe('"line1\r\nline2"');
  });

  it('doubles inner quotes', () => {
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape('a,"b",c')).toBe('"a,""b"",c"');
  });
});

describe('toCsv', () => {
  it('returns empty string for no rows', () => {
    expect(toCsv([])).toBe('');
  });

  it('builds header + rows with CRLF endings and trailing newline', () => {
    const csv = toCsv([
      { name: 'alpha', mins: 30 },
      { name: 'beta', mins: 45 },
    ]);
    expect(csv).toBe('name,mins\r\nalpha,30\r\nbeta,45\r\n');
  });

  it('uses first row keys as headers and fills missing values with empty', () => {
    const csv = toCsv([
      { a: 'x', b: 'y' },
      { a: 'z' } as Record<string, string>,
    ]);
    expect(csv).toBe('a,b\r\nx,y\r\nz,\r\n');
  });

  it('escapes values containing separators', () => {
    const csv = toCsv([{ title: 'a,b', notes: 'has "quote"' }]);
    expect(csv).toBe('title,notes\r\n"a,b","has ""quote"""\r\n');
  });
});
