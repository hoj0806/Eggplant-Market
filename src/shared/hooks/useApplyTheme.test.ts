import { act, renderHook } from '@testing-library/react';
import { useApplyTheme } from './useApplyTheme';
import { useUiStore } from '../store/uiStore';
import { DARK_CLASS, DEFAULT_THEME_PREFERENCE, type ThemePreference } from '../utils/theme';

type ChangeListener = () => void;

type MatchMediaStub = {
  /** 기기의 다크모드 설정이 바뀐 상황을 만든다. */
  change(prefersDark: boolean): void;
};

/**
 * jsdom에는 matchMedia가 없다. 시스템 설정을 흉내 내고 구독자도 붙잡아 둔다 —
 * 구독을 하는지 안 하는지가 이 훅에서 확인해야 할 절반이다.
 */
function stubMatchMedia(prefersDark: boolean): MatchMediaStub {
  const listeners: ChangeListener[] = [];
  const mediaQueryList = {
    matches: prefersDark,
    addEventListener(_type: string, listener: ChangeListener): void {
      listeners.push(listener);
    },
    removeEventListener(_type: string, listener: ChangeListener): void {
      const index = listeners.indexOf(listener);

      if (index !== -1) {
        listeners.splice(index, 1);
      }
    },
  };

  window.matchMedia = function matchMedia(): MediaQueryList {
    return mediaQueryList as unknown as MediaQueryList;
  };

  return {
    change(next: boolean): void {
      mediaQueryList.matches = next;
      listeners.forEach(function notify(listener: ChangeListener): void {
        listener();
      });
    },
  };
}

function renderWithTheme(theme: ThemePreference, prefersDark: boolean): MatchMediaStub {
  const media = stubMatchMedia(prefersDark);

  useUiStore.setState({ theme });
  renderHook(useApplyTheme);

  return media;
}

function isDark(): boolean {
  return document.documentElement.classList.contains(DARK_CLASS);
}

describe('useApplyTheme', function useApplyThemeSuite() {
  beforeEach(function resetEnvironment() {
    document.documentElement.classList.remove(DARK_CLASS);
    useUiStore.setState({ theme: DEFAULT_THEME_PREFERENCE });
  });

  it('시스템을 고르면 기기 설정을 따라 dark 클래스를 붙인다', function followsSystem() {
    renderWithTheme('system', true);

    expect(isDark()).toBe(true);
  });

  it('기기가 라이트면 클래스를 붙이지 않는다', function followsSystemLight() {
    renderWithTheme('system', false);

    expect(isDark()).toBe(false);
  });

  it('직접 고른 값이 기기 설정을 이긴다', function explicitWins() {
    renderWithTheme('dark', false);

    expect(isDark()).toBe(true);
  });

  it('시스템을 고른 동안에는 기기 설정 변화를 따라간다', function tracksSystemChange() {
    const media = renderWithTheme('system', false);

    act(function changeSystem() {
      media.change(true);
    });

    expect(isDark()).toBe(true);
  });

  it('직접 고른 뒤에는 기기 설정이 바뀌어도 그대로 둔다', function ignoresSystemChange() {
    // 라이트로 쓰겠다고 고른 사람의 화면이 해가 지면 혼자 뒤집히면 안 된다.
    const media = renderWithTheme('light', false);

    act(function changeSystem() {
      media.change(true);
    });

    expect(isDark()).toBe(false);
  });
});
