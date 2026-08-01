type ErrorLike = {
  message?: unknown;
  code?: unknown;
};

/**
 * Error 인스턴스가 아닐 수도 있으므로(직렬화된 응답, PostgrestError 등)
 * code·message를 모아 하나의 문자열로 만든다. 패턴 매칭용이라 소문자로 내린다.
 */
export function extractErrorText(error: unknown): string {
  if (typeof error === 'string') {
    return error.toLowerCase();
  }
  if (error === null || typeof error !== 'object') {
    return '';
  }

  const candidate = error as ErrorLike;
  const parts: string[] = [];
  if (typeof candidate.code === 'string') {
    parts.push(candidate.code);
  }
  if (typeof candidate.message === 'string') {
    parts.push(candidate.message);
  }
  return parts.join(' ').toLowerCase();
}

/** 패턴 목록을 위에서부터 훑어 첫 번째로 맞는 문구를 돌려준다. 순서가 곧 우선순위다. */
export function matchErrorMessage(
  error: unknown,
  patterns: ReadonlyArray<readonly [RegExp, string]>,
  fallback: string,
): string {
  const text = extractErrorText(error);
  if (text.length === 0) {
    return fallback;
  }

  for (const [pattern, message] of patterns) {
    if (pattern.test(text)) {
      return message;
    }
  }

  return fallback;
}
