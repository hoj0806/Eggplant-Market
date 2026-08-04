import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PostSortSelect from './postSortSelect';
import { POST_SORT_OPTIONS } from '../utils/postSort';

describe('PostSortSelect', function postSortSelectSuite() {
  it('고를 수 있는 정렬을 모두 보여준다', function showsEveryOption() {
    render(<PostSortSelect value="latest" onChange={jest.fn()} />);

    expect(screen.getAllByRole('option')).toHaveLength(POST_SORT_OPTIONS.length);
    expect(screen.getByRole('combobox', { name: '정렬 기준' })).toHaveValue('latest');
  });

  it('지금 정렬을 선택된 상태로 보여준다', function reflectsValue() {
    render(<PostSortSelect value="price_desc" onChange={jest.fn()} />);

    expect(screen.getByRole('combobox', { name: '정렬 기준' })).toHaveValue('price_desc');
  });

  it('고른 정렬을 그대로 올려보낸다', function reportsSelection() {
    const handleChange = jest.fn();
    render(<PostSortSelect value="latest" onChange={handleChange} />);

    return userEvent
      .selectOptions(screen.getByRole('combobox', { name: '정렬 기준' }), 'likes')
      .then(function assertCalled(): void {
        expect(handleChange).toHaveBeenCalledWith('likes');
      });
  });
});
