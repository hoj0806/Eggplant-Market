import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import SearchScopeToggle from './searchScopeToggle';
import type { PostSearchScope } from '../types';

type RenderOptions = {
  value?: PostSearchScope;
  radiusM?: number;
  isGuest?: boolean;
  onChange?: jest.Mock;
};

function renderToggle(options: RenderOptions = {}) {
  const handleChange = options.onChange ?? jest.fn();

  render(
    <MemoryRouter>
      <SearchScopeToggle
        value={options.value ?? 'region'}
        radiusM={options.radiusM ?? 2000}
        isGuest={options.isGuest ?? false}
        onChange={handleChange}
      />
    </MemoryRouter>,
  );

  return handleChange;
}

describe('SearchScopeToggle', function searchScopeToggleSuite() {
  it('반경 버튼에 지금 반경을 적는다', function showsRadius() {
    renderToggle({ radiusM: 500 });

    expect(screen.getByRole('button', { name: '500m 이내' })).toBeInTheDocument();
  });

  it('지금 기준만 눌린 상태다', function marksSelected() {
    renderToggle({ value: 'radius', radiusM: 2000 });

    expect(screen.getByRole('button', { name: '우리 동네' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('button', { name: '2km 이내' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('다른 기준을 누르면 그 기준을 올려보낸다', function reportsChange() {
    const handleChange = renderToggle({ value: 'region' });

    return userEvent
      .click(screen.getByRole('button', { name: '2km 이내' }))
      .then(function assertCalled(): void {
        expect(handleChange).toHaveBeenCalledWith('radius');
      });
  });

  it('보고 있던 기준을 다시 누르면 아무 일도 하지 않는다', function ignoresSameScope() {
    // 같은 값을 다시 올리면 URL이 한 칸 더 쌓여 뒤로가기가 제자리걸음을 한다.
    const handleChange = renderToggle({ value: 'region' });

    return userEvent
      .click(screen.getByRole('button', { name: '우리 동네' }))
      .then(function assertNotCalled(): void {
        expect(handleChange).not.toHaveBeenCalled();
      });
  });

  it('법정동 기준일 때는 설명을 띄우지 않는다', function noHintInRegionScope() {
    renderToggle({ value: 'region' });

    expect(screen.queryByRole('link', { name: '반경 바꾸기' })).toBeNull();
  });

  it('반경 기준일 때 반경을 바꾸러 갈 길을 준다', function offersRadiusSettings() {
    renderToggle({ value: 'radius' });

    expect(screen.getByRole('link', { name: '반경 바꾸기' })).toHaveAttribute(
      'href',
      '/settings/region',
    );
  });

  it('게스트에게는 반경을 바꾸라고 하지 않는다', function guestHasNoRadiusSetting() {
    // 저장할 곳이 없어 언제나 기본값이다. 설정으로 보내면 막다른 길이 된다.
    renderToggle({ value: 'radius', isGuest: true });

    expect(screen.queryByRole('link', { name: '반경 바꾸기' })).toBeNull();
    expect(screen.getByText(/로그인이 필요해요/)).toBeInTheDocument();
  });
});
