import { useEffect } from 'react';
import { selectTheme, useUiStore } from '../store/uiStore';
import { DARK_CLASS, resolveTheme } from '../utils/theme';

const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';

/**
 * 고른 테마를 <html>의 클래스로 옮긴다.
 *
 * 모든 `dark:` 스타일이 이 클래스 하나에 달려 있다(`index.css`의 `@custom-variant dark`).
 * 앱 전체에서 딱 한 번, 최상단에서만 부른다 — 여러 곳에서 부르면 서로 클래스를 지운다.
 *
 * '시스템'일 때만 시스템 설정 변화를 구독한다. 직접 고른 사람에게는 시스템이 바뀌든 말든
 * 화면이 멋대로 뒤집히지 않아야 한다.
 */
export function useApplyTheme(): void {
  const theme = useUiStore(selectTheme);

  useEffect(
    function applyTheme(): (() => void) | undefined {
      const media = window.matchMedia(DARK_MEDIA_QUERY);

      function syncClass(): void {
        const resolved = resolveTheme(theme, media.matches);

        document.documentElement.classList.toggle(DARK_CLASS, resolved === 'dark');
      }

      syncClass();

      if (theme !== 'system') {
        return undefined;
      }

      media.addEventListener('change', syncClass);

      return function unsubscribe(): void {
        media.removeEventListener('change', syncClass);
      };
    },
    [theme],
  );
}
