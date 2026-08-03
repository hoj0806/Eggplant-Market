import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SellingStatusFilter from './sellingStatusFilter';
import type { SellingStatusFilter as StatusFilter } from '../types';

function renderFilter(value: StatusFilter) {
  const handleChange = jest.fn();

  render(<SellingStatusFilter value={value} onChange={handleChange} />);

  return handleChange;
}

describe('SellingStatusFilter', function sellingStatusFilterSuite() {
  it('전체와 세 가지 상태를 보여준다', function showsOptions() {
    renderFilter(null);

    expect(screen.getByRole('button', { name: '전체' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '판매중' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '예약중' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '거래완료' })).toBeInTheDocument();
  });

  it('상태를 고르면 그 값으로 알려 준다', async function selectsStatus() {
    const handleChange = renderFilter(null);

    await userEvent.click(screen.getByRole('button', { name: '예약중' }));

    expect(handleChange).toHaveBeenCalledWith('reserved');
  });

  it('전체를 고르면 필터를 푼다(null)', async function selectsAll() {
    const handleChange = renderFilter('sold');

    await userEvent.click(screen.getByRole('button', { name: '전체' }));

    expect(handleChange).toHaveBeenCalledWith(null);
  });
});
