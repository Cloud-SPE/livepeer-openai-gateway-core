// Glob matcher for rate-card pattern entries. Supports `*` (zero or more
// chars) and `?` (exactly one char). No regex, no character classes,
// no escapes — operator-authored patterns are rate-card model strings,
// not paths or DSL.
//
// Examples:
//   "Qwen3.*"  matches "Qwen3.6-27B", "Qwen3-32B", "Qwen3.5"
//   "*-27B"    matches "Qwen3.6-27B", "Llama-27B"
//   "?qwen*"   matches "Aqwen-7B" (single-char prefix); not "qwen-7B"
//
// Implementation: compile glob → RegExp once per pattern, cache by
// glob string. The cache is process-lifetime (rate-card patterns
// rarely change shape after authoring; the cache pays for itself
// after one re-evaluation).

const compiledCache = new Map<string, RegExp>();

/** Convert a glob to a RegExp. Anchored at both ends. */
function compileGlob(glob: string): RegExp {
  const cached = compiledCache.get(glob);
  if (cached) return cached;

  let re = '^';
  for (const ch of glob) {
    if (ch === '*') re += '.*';
    else if (ch === '?') re += '.';
    else re += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  re += '$';

  const compiled = new RegExp(re);
  compiledCache.set(glob, compiled);
  return compiled;
}

/** Test whether a glob matches an input string (anchored). */
export function globMatch(glob: string, input: string): boolean {
  return compileGlob(glob).test(input);
}

/** Reset the compile cache. Test-only. */
export function _resetGlobCacheForTests(): void {
  compiledCache.clear();
}
