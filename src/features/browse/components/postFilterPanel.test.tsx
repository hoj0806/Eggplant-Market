import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PostFilterPanel from './postFilterPanel';
import { EMPTY_POST_SEARCH_FILTERS } from '../utils/postSearchFilters';
import type { CategoryTree } from '../../category/types';
import type { PostSearchFilters } from '../types';

// categoryApi는 supabaseClient를 거쳐 import.meta.env에 닿는다. 실제 모듈은 로드하지 않는다.
const mockFetchCategoryTree = jest.fn();

jest.mock('../../category/api/categoryApi', function mockCategoryApi() {
  return {
    fetchCategoryTree: function fetchCategoryTree() {
      return mockFetchCategoryTree();
    },
  };
});

const TREES: CategoryTree[] = [
  {
    id: 1,
    name: '디지털/가전',
    slug: 'digital',
    children: [{ id: 15, name: '노트북', slug: 'digital-laptop' }],
  },
];

function renderPanel(
  onApply: jest.Mock,
  filters: PostSearchFilters = EMPTY_POST_SEARCH_FILTERS,
  onClose: jest.Mock = jest.fn(),
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <PostFilterPanel filters={filters} onApply={onApply} onClose={onClose} />
    </QueryClientProvider>,
  );
}

describe('PostFilterPanel', function postFilterPanelSuite() {
  beforeEach(function resetMocks() {
    jest.clearAllMocks();
    mockFetchCategoryTree.mockResolvedValue(TREES);
  });

  it('적용하기 전에는 부모에게 아무것도 넘기지 않는다', async function draftIsLocalCase() {
    const handleApply = jest.fn();
    renderPanel(handleApply);

    await userEvent.type(screen.getByLabelText('최소 가격'), '10000');
    await userEvent.click(screen.getByLabelText(/거래 가능만 보기/));

    expect(handleApply).not.toHaveBeenCalled();
  });

  it('적용하기를 누르면 고친 값을 한 번에 넘긴다', async function applyCase() {
    const handleApply = jest.fn();
    renderPanel(handleApply);

    await userEvent.type(screen.getByLabelText('최소 가격'), '10000');
    await userEvent.type(screen.getByLabelText('최대 가격'), '50000');
    await userEvent.click(screen.getByLabelText(/거래 가능만 보기/));
    await userEvent.click(screen.getByRole('button', { name: '적용하기' }));

    expect(handleApply).toHaveBeenCalledTimes(1);
    expect(handleApply).toHaveBeenCalledWith({
      keyword: '',
      categoryId: null,
      minPrice: 10000,
      maxPrice: 50000,
      availableOnly: true,
    });
  });

  it('검색어는 패널이 건드리지 않고 그대로 돌려준다', async function keepsKeywordCase() {
    const handleApply = jest.fn();
    renderPanel(handleApply, { ...EMPTY_POST_SEARCH_FILTERS, keyword: '노트북' });

    await userEvent.click(screen.getByRole('button', { name: '적용하기' }));

    expect(handleApply).toHaveBeenCalledWith(
      expect.objectContaining({ keyword: '노트북' }),
    );
  });

  it('최소가 최대보다 크면 이유를 알려 주고 적용을 막는다', async function reversedRangeCase() {
    const handleApply = jest.fn();
    renderPanel(handleApply);

    await userEvent.type(screen.getByLabelText('최소 가격'), '50000');
    await userEvent.type(screen.getByLabelText('최대 가격'), '10000');

    expect(screen.getByRole('alert')).toHaveTextContent('최소 가격이 최대 가격보다 큽니다.');
    expect(screen.getByRole('button', { name: '적용하기' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: '적용하기' }));
    expect(handleApply).not.toHaveBeenCalled();
  });

  it('가격에 숫자가 아닌 값을 넣으면 적용을 막는다', async function invalidPriceCase() {
    renderPanel(jest.fn());

    await userEvent.type(screen.getByLabelText('최소 가격'), '만원');

    expect(screen.getByRole('alert')).toHaveTextContent('가격은 0 이상의 숫자로 입력해 주세요.');
    expect(screen.getByRole('button', { name: '적용하기' })).toBeDisabled();
  });

  it('가격 칸을 비우면 그 조건은 없는 것으로 넘긴다', async function clearedPriceCase() {
    const handleApply = jest.fn();
    renderPanel(handleApply, { ...EMPTY_POST_SEARCH_FILTERS, minPrice: 10000 });

    await userEvent.clear(screen.getByLabelText('최소 가격'));
    await userEvent.click(screen.getByRole('button', { name: '적용하기' }));

    expect(handleApply).toHaveBeenCalledWith(expect.objectContaining({ minPrice: null }));
  });

  it('열 때 이미 적용돼 있던 값을 보여준다', function initialValueCase() {
    renderPanel(jest.fn(), {
      keyword: '',
      categoryId: null,
      minPrice: 1000,
      maxPrice: 2000,
      availableOnly: true,
    });

    expect(screen.getByLabelText('최소 가격')).toHaveValue('1000');
    expect(screen.getByLabelText('최대 가격')).toHaveValue('2000');
    expect(screen.getByLabelText(/거래 가능만 보기/)).toBeChecked();
  });
});
