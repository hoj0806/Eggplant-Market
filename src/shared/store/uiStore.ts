import { create } from 'zustand';
import {
  DEFAULT_THEME_PREFERENCE,
  toThemePreference,
  type ThemePreference,
} from '../utils/theme';

/** 첫 화면의 깜빡임을 막으려고 `index.html`의 인라인 스크립트도 같은 키를 읽는다. */
export const THEME_STORAGE_KEY = 'eggplant-theme';

/**
 * localStorage는 사파리 프라이빗 모드나 쿠키 차단 설정에서 접근만으로도 예외를 던진다.
 * 테마 하나 때문에 앱이 뜨지 않으면 안 되므로 실패하면 기본값으로 산다.
 */
function readStoredTheme(): ThemePreference {
  try {
    return toThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_THEME_PREFERENCE;
  }
}

function writeStoredTheme(theme: ThemePreference): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // 저장에 실패해도 이번 세션 동안은 고른 대로 보여준다. 다음에 열면 기본값으로 돌아갈 뿐이다.
  }
}

type UiStoreState = {
  theme: ThemePreference;
  setTheme(theme: ThemePreference): void;
};

/**
 * 서버와 상관없는 화면 설정. 로그인 여부와 무관하므로 프로필이 아니라 이 기기에 남긴다 —
 * 회사 노트북은 라이트, 집 휴대폰은 다크로 두는 편이 자연스럽다.
 */
export const useUiStore = create<UiStoreState>(function initUiStore(set) {
  return {
    theme: readStoredTheme(),
    setTheme(theme) {
      writeStoredTheme(theme);
      set({ theme });
    },
  };
});

export function selectTheme(state: UiStoreState): ThemePreference {
  return state.theme;
}

export function selectSetTheme(state: UiStoreState): UiStoreState['setTheme'] {
  return state.setTheme;
}
