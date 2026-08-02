import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CategoryFilterSelect from './categoryFilterSelect';
import type { CategoryTree } from '../../category/types';

// categoryApi는 supabaseClient를 거쳐 import.meta.env에 닿는다.
// ts-jest는 CommonJS로 옮기면서 import.meta를 그대로 뱉으므로 실제 모듈을 로드하면 죽는다.
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
    children: [
      { id: 13, name: '휴대폰', slug: 'digital-phone' },
      { id: 14, name: '태블릿/PC', slug: 'digital-tablet' },
    ],
  },
  {
    id: 2,
    name: '가구/인테리어',
    slug: 'furniture',
    children: [{ id: 20, name: '침실가구', slug: 'furniture-bedroom' }],
  },
];

function renderSelect(onChange: jest.Mock, value: number | null = null) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <CategoryFilterSelect value={value} onChange={onChange} />
    </QueryClientProvider>,
  );
}

async function waitForCategories(): Promise<void> {
  await waitFor(function assertLoaded() {
    expect(screen.getByRole('option', { name: '디지털/가전' })).toBeInTheDocument();
  });
}

describe('CategoryFilterSelect', function categoryFilterSelectSuite() {
  beforeEach(function resetMocks() {
    jest.clearAllMocks();
    mockFetchCategoryTree.mockResolvedValue(TREES);
  });

  it('대분류만 골라도 그 대분류가 필터 값이 된다', async function parentOnlyCase() {
    const handleChange = jest.fn();
    renderSelect(handleChange);
    await waitForCategories();

    await userEvent.selectOptions(screen.getByLabelText('대분류'), '1');

    expect(handleChange).toHaveBeenLastCalledWith(1);
  });

  it('소분류까지 고르면 소분류가 필터 값이 된다', async function childCase() {
    const handleChange = jest.fn();
    renderSelect(handleChange, 1);
    await waitForCategories();

    await userEvent.selectOptions(screen.getByLabelText('소분류'), '14');

    expect(handleChange).toHaveBeenLastCalledWith(14);
  });

  it('소분류를 전체로 되돌리면 대분류 조건으로 물러선다', async function backToParentCase() {
    const handleChange = jest.fn();
    renderSelect(handleChange, 14);
    await waitForCategories();

    await userEvent.selectOptions(screen.getByLabelText('소분류'), '');

    expect(handleChange).toHaveBeenLastCalledWith(1);
  });

  it('소분류 값을 받으면 그 대분류를 펼쳐 둔다', async function restoreParentCase() {
    renderSelect(jest.fn(), 20);

    await waitFor(function assertParentSelected() {
      expect(screen.getByLabelText('대분류')).toHaveValue('2');
    });
    expect(screen.getByLabelText('소분류')).toHaveValue('20');
  });

  it('대분류 값을 받으면 소분류는 전체로 둔다', async function parentValueCase() {
    renderSelect(jest.fn(), 2);

    await waitFor(function assertParentSelected() {
      expect(screen.getByLabelText('대분류')).toHaveValue('2');
    });
    expect(screen.getByLabelText('소분류')).toHaveValue('');
  });

  it('대분류를 전체로 되돌리면 카테고리 조건이 사라진다', async function clearCase() {
    const handleChange = jest.fn();
    renderSelect(handleChange, 14);
    await waitForCategories();

    await userEvent.selectOptions(screen.getByLabelText('대분류'), '');

    expect(handleChange).toHaveBeenLastCalledWith(null);
  });
});
