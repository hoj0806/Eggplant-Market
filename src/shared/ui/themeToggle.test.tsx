import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ThemeToggle from './themeToggle';
import { useUiStore } from '../store/uiStore';
import { DEFAULT_THEME_PREFERENCE } from '../utils/theme';

describe('ThemeToggle', function themeToggleSuite() {
  beforeEach(function resetStore() {
    window.localStorage.clear();
    useUiStore.setState({ theme: DEFAULT_THEME_PREFERENCE });
  });

  it('세 갈래를 모두 보여준다', function showsOptions() {
    render(<ThemeToggle />);

    expect(screen.getByRole('button', { name: '시스템' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '라이트' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다크' })).toBeInTheDocument();
  });

  it('고른 갈래를 눌린 상태로 알린다', function marksSelected() {
    useUiStore.setState({ theme: 'dark' });

    render(<ThemeToggle />);

    expect(screen.getByRole('button', { name: '다크' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '시스템' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('누르면 그 테마로 바꾼다', async function changesTheme() {
    render(<ThemeToggle />);

    await userEvent.click(screen.getByRole('button', { name: '라이트' }));

    expect(useUiStore.getState().theme).toBe('light');
    expect(screen.getByRole('button', { name: '라이트' })).toHaveAttribute('aria-pressed', 'true');
  });
});
