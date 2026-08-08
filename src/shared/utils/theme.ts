/** 사용자가 고른 값. 'system'은 "내가 안 고르겠다"는 선택이다. */
export type ThemePreference = 'light' | 'dark' | 'system';

/** 실제로 화면에 적용되는 값. 'system'은 여기까지 오지 않는다. */
export type ResolvedTheme = 'light' | 'dark';

/** `index.css`의 `@custom-variant dark`가 찾는 클래스. 이 이름이 곧 모든 `dark:` 스타일의 스위치다. */
export const DARK_CLASS = 'dark';

export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'system';

/** 토글에 놓는 순서. 기본값을 맨 앞에 둔다. */
export const THEME_PREFERENCE_ORDER: ReadonlyArray<ThemePreference> = ['system', 'light', 'dark'];

export const THEME_PREFERENCE_LABEL: Record<ThemePreference, string> = {
  system: '시스템',
  light: '라이트',
  dark: '다크',
};

/**
 * 저장돼 있던 값을 읽는다.
 *
 * 모르는 값과 빈 값은 조용히 기본값으로 떨어진다 — localStorage는 사용자가 직접 고칠 수 있는
 * 자리라 무엇이 들어 있어도 화면이 깨지면 안 된다(toChatRoomFilter와 같은 태도).
 */
export function toThemePreference(raw: string | null): ThemePreference {
  const found = THEME_PREFERENCE_ORDER.find(function matches(preference: ThemePreference): boolean {
    return preference === raw;
  });

  return found ?? DEFAULT_THEME_PREFERENCE;
}

/** 고른 값과 지금 시스템 설정을 합쳐 실제로 적용할 테마를 정한다. */
export function resolveTheme(preference: ThemePreference, prefersDark: boolean): ResolvedTheme {
  if (preference === 'system') {
    return prefersDark ? 'dark' : 'light';
  }

  return preference;
}
