import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CategorySelect from './categorySelect';
import type { CategoryTree } from '../types';

// categoryApi는 supabaseClient를 거쳐 import.meta.env에 닿는다.
// ts-jest는 CommonJS로 옮기면서 import.meta를 그대로 뱉으므로 실제 모듈을 로드하면 죽는다.
const mockFetchCategoryTree = jest.fn();

jest.mock('../api/categoryApi', function mockCategoryApi() {
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
      { id: 14, name: '노트북', slug: 'digital-laptop' },
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
      <CategorySelect value={value} onChange={onChange} />
    </QueryClientProvider>,
  );
}

describe('CategorySelect', function categorySelectSuite() {
  beforeEach(function resetMocks() {
    jest.clearAllMocks();
    mockFetchCategoryTree.mockResolvedValue(TREES);
  });

  it('대분류를 고르기 전에는 소분류를 고를 수 없다', async function lockedChildCase() {
    renderSelect(jest.fn());

    await waitFor(function assertLoaded() {
      expect(screen.getByRole('option', { name: '디지털/가전' })).toBeInTheDocument();
    });
    expect(screen.getByLabelText('소분류')).toBeDisabled();
  });

  it('고른 대분류의 소분류만 보여준다', async function childOptionsCase() {
    renderSelect(jest.fn());

    await waitFor(function assertLoaded() {
      expect(screen.getByRole('option', { name: '디지털/가전' })).toBeInTheDocument();
    });
    await userEvent.selectOptions(screen.getByLabelText('대분류'), '1');

    expect(screen.getByRole('option', { name: '휴대폰' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: '침실가구' })).not.toBeInTheDocument();
  });

  it('소분류를 고르면 그 id를 부모에게 넘긴다', async function selectChildCase() {
    const handleChange = jest.fn();
    renderSelect(handleChange);

    await waitFor(function assertLoaded() {
      expect(screen.getByRole('option', { name: '디지털/가전' })).toBeInTheDocument();
    });
    await userEvent.selectOptions(screen.getByLabelText('대분류'), '1');
    await userEvent.selectOptions(screen.getByLabelText('소분류'), '14');

    expect(handleChange).toHaveBeenLastCalledWith(14);
  });

  it('대분류를 바꾸면 이미 고른 소분류를 비운다', async function resetChildCase() {
    const handleChange = jest.fn();
    renderSelect(handleChange, 13);

    await waitFor(function assertLoaded() {
      expect(screen.getByRole('option', { name: '디지털/가전' })).toBeInTheDocument();
    });
    await userEvent.selectOptions(screen.getByLabelText('대분류'), '2');

    expect(handleChange).toHaveBeenLastCalledWith(null);
  });

  it('이미 고른 소분류가 있으면 그 대분류를 펼쳐 둔다', async function restoreParentCase() {
    renderSelect(jest.fn(), 20);

    await waitFor(function assertParentSelected() {
      expect(screen.getByLabelText('대분류')).toHaveValue('2');
    });
    expect(screen.getByLabelText('소분류')).toHaveValue('20');
  });
});
