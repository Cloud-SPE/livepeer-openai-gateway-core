import { describe, expect, it, beforeEach } from 'vitest';
import { _resetGlobCacheForTests, globMatch } from './glob.js';

describe('globMatch', () => {
  beforeEach(() => _resetGlobCacheForTests());

  it('matches an exact literal', () => {
    expect(globMatch('Qwen3', 'Qwen3')).toBe(true);
    expect(globMatch('Qwen3', 'Qwen2')).toBe(false);
  });

  it('matches with `*` wildcard for zero-or-more chars', () => {
    expect(globMatch('Qwen3.*', 'Qwen3.6-27B')).toBe(true);
    expect(globMatch('Qwen3.*', 'Qwen3.')).toBe(true); // zero chars after .
    expect(globMatch('Qwen3.*', 'Qwen2.5')).toBe(false);
  });

  it('matches with `?` wildcard for exactly one char', () => {
    expect(globMatch('?wen', 'Qwen')).toBe(true);
    expect(globMatch('?wen', 'wen')).toBe(false); // zero chars before
    expect(globMatch('?wen', 'Bwen')).toBe(true);
  });

  it('combines `*` and `?`', () => {
    expect(globMatch('Q?en*-27B', 'Qwen3.6-27B')).toBe(true);
    expect(globMatch('Q?en*-27B', 'Qwen3.6-32B')).toBe(false);
  });

  it('is anchored at both ends', () => {
    expect(globMatch('Qwen', 'XQwenY')).toBe(false);
    expect(globMatch('*Qwen*', 'XQwenY')).toBe(true);
  });

  it('escapes regex meta-characters in the pattern', () => {
    // `.` is a regex meta-char but not a glob wildcard — must be a literal dot.
    expect(globMatch('Qwen3.6', 'Qwen3.6')).toBe(true);
    expect(globMatch('Qwen3.6', 'Qwen3X6')).toBe(false);
    // Other meta-chars
    expect(globMatch('a+b', 'a+b')).toBe(true);
    expect(globMatch('a+b', 'aab')).toBe(false);
    expect(globMatch('(test)', '(test)')).toBe(true);
  });

  it('caches compiled patterns', () => {
    // Just exercise the cache path — repeat call should return same result.
    expect(globMatch('Qwen*', 'Qwen3')).toBe(true);
    expect(globMatch('Qwen*', 'Qwen3')).toBe(true);
    expect(globMatch('Qwen*', 'GPT-4')).toBe(false);
  });
});
