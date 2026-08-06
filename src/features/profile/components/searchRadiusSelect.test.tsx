import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SearchRadiusSelect from './searchRadiusSelect';
import { SEARCH_RADIUS_OPTIONS } from '../../browse/utils/searchRadius';

describe('SearchRadiusSelect', function searchRadiusSelectSuite() {
  it('고를 수 있는 반경을 모두 보여준다', function showsEveryOption() {
    render(<SearchRadiusSelect value={2000} disabled={false} onChange={jest.fn()} />);

    expect(
      screen.getAllByRole('button', { name: /^(\d+m|[\d.]+km)$/ }),
    ).toHaveLength(SEARCH_RADIUS_OPTIONS.length);
  });

  it('지금 반경만 눌린 상태다', function marksSelected() {
    render(<SearchRadiusSelect value={2000} disabled={false} onChange={jest.fn()} />);

    expect(screen.getByRole('button', { name: '2km' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '500m' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('다른 반경을 누르면 그 값을 올려보낸다', function reportsChange() {
    const handleChange = jest.fn();
    render(<SearchRadiusSelect value={2000} disabled={false} onChange={handleChange} />);

    return userEvent
      .click(screen.getByRole('button', { name: '5km' }))
      .then(function assertCalled(): void {
        expect(handleChange).toHaveBeenCalledWith(5000);
      });
  });

  it('보고 있던 반경을 다시 눌러도 저장하지 않는다', function ignoresSameValue() {
    // 같은 값을 다시 쓰면 요청만 한 번 더 나가고 바뀌는 것이 없다.
    const handleChange = jest.fn();
    render(<SearchRadiusSelect value={2000} disabled={false} onChange={handleChange} />);

    return userEvent
      .click(screen.getByRole('button', { name: '2km' }))
      .then(function assertNotCalled(): void {
        expect(handleChange).not.toHaveBeenCalled();
      });
  });

  it('저장 중에는 누를 수 없다', function disabledWhilePending() {
    render(<SearchRadiusSelect value={2000} disabled onChange={jest.fn()} />);

    expect(screen.getByRole('button', { name: '5km' })).toBeDisabled();
  });
});
