import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PostForm from './postForm';
import type { CategoryTree } from '../../category/types';
import type { PostFormValues } from '../types';

// 두 api 모듈 모두 import.meta(supabaseClient·kakaoMapLoader)에 닿는다.
// ts-jest가 CommonJS로 옮기면서 import.meta를 그대로 뱉으므로 실제 모듈을 로드하면 죽는다.
const mockFetchCategoryTree = jest.fn();
const mockSearchPlacesByKeyword = jest.fn();

jest.mock('../../category/api/categoryApi', function mockCategoryApi() {
  return {
    fetchCategoryTree: function fetchCategoryTree() {
      return mockFetchCategoryTree();
    },
  };
});

jest.mock('../../place/api/placeApi', function mockPlaceApi() {
  return {
    searchPlacesByKeyword: function searchPlacesByKeyword(query: string, center: unknown) {
      return mockSearchPlacesByKeyword(query, center);
    },
  };
});

const TREES: CategoryTree[] = [
  {
    id: 1,
    name: '디지털/가전',
    slug: 'digital',
    children: [{ id: 14, name: '노트북', slug: 'digital-laptop' }],
  },
];

const CENTER = { lat: 37.6379, lng: 127.0146 };

function makeImageFile(name = 'photo.jpg'): File {
  return new File(['image-bytes'], name, { type: 'image/jpeg' });
}

function renderForm(onSubmit: jest.Mock, isPending = false) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  render(
    <QueryClientProvider client={queryClient}>
      <PostForm mode="create" center={CENTER} isPending={isPending} onSubmit={onSubmit} />
    </QueryClientProvider>,
  );
}

const EDIT_VALUES: PostFormValues = {
  title: '맥북 에어 M2',
  description: '2년 정도 사용했고 배터리 성능 90%입니다.',
  price: '850000',
  categoryId: 14,
  images: [{ kind: 'existing', url: 'https://example.supabase.co/a.jpg' }],
  tradePlace: null,
};

function renderEditForm(onSubmit: jest.Mock) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  render(
    <QueryClientProvider client={queryClient}>
      <PostForm
        mode="edit"
        center={CENTER}
        initialValues={EDIT_VALUES}
        isPending={false}
        onSubmit={onSubmit}
      />
    </QueryClientProvider>,
  );
}

async function fillValidForm(): Promise<void> {
  await userEvent.upload(screen.getByLabelText('상품 사진 추가'), makeImageFile());
  await userEvent.type(screen.getByLabelText('제목'), '맥북 에어 M2');

  await waitFor(function assertCategoriesLoaded() {
    expect(screen.getByRole('option', { name: '디지털/가전' })).toBeInTheDocument();
  });
  await userEvent.selectOptions(screen.getByLabelText('대분류'), '1');
  await userEvent.selectOptions(screen.getByLabelText('소분류'), '14');

  await userEvent.type(screen.getByLabelText('가격'), '850000');
  await userEvent.type(
    screen.getByLabelText('상품 설명'),
    '2년 정도 사용했고 배터리 성능 90%입니다.',
  );
}

describe('PostForm', function postFormSuite() {
  beforeEach(function resetMocks() {
    jest.clearAllMocks();
    mockFetchCategoryTree.mockResolvedValue(TREES);
    mockSearchPlacesByKeyword.mockResolvedValue([]);
  });

  it('빈 폼을 제출하면 필수 항목을 모두 짚어 준다', async function emptySubmitCase() {
    const handleSubmit = jest.fn();
    renderForm(handleSubmit);

    await userEvent.click(screen.getByRole('button', { name: '등록하기' }));

    expect(await screen.findByText('상품 사진을 최소 1장 올려 주세요.')).toBeInTheDocument();
    expect(screen.getByText('제목을 입력해 주세요.')).toBeInTheDocument();
    expect(screen.getByText('카테고리를 소분류까지 선택해 주세요.')).toBeInTheDocument();
    expect(screen.getByText('상품 설명을 입력해 주세요.')).toBeInTheDocument();
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('채워진 값을 그대로 부모에게 넘긴다', async function submitCase() {
    const handleSubmit = jest.fn();
    renderForm(handleSubmit);

    await fillValidForm();
    await userEvent.click(screen.getByRole('button', { name: '등록하기' }));

    await waitFor(function assertSubmitted() {
      expect(handleSubmit).toHaveBeenCalledTimes(1);
    });
    const values = handleSubmit.mock.calls[0][0];
    expect(values.title).toBe('맥북 에어 M2');
    expect(values.price).toBe('850000');
    expect(values.categoryId).toBe(14);
    expect(values.images).toHaveLength(1);
    expect(values.images[0].kind).toBe('new');
    // 거래희망장소는 선택 사항이라 고르지 않아도 제출된다.
    expect(values.tradePlace).toBeNull();
  });

  it('나눔을 고르면 가격이 0원이 된다', async function freeCase() {
    const handleSubmit = jest.fn();
    renderForm(handleSubmit);

    await fillValidForm();
    await userEvent.click(screen.getByRole('checkbox', { name: '무료로 나눔할게요' }));
    await userEvent.click(screen.getByRole('button', { name: '등록하기' }));

    await waitFor(function assertSubmitted() {
      expect(handleSubmit).toHaveBeenCalledTimes(1);
    });
    expect(handleSubmit.mock.calls[0][0].price).toBe('0');
  });

  it('고친 필드의 오류 문구는 바로 사라진다', async function clearErrorCase() {
    renderForm(jest.fn());

    await userEvent.click(screen.getByRole('button', { name: '등록하기' }));
    expect(await screen.findByText('제목을 입력해 주세요.')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('제목'), '맥북');

    expect(screen.queryByText('제목을 입력해 주세요.')).not.toBeInTheDocument();
  });

  it('저장 중에는 다시 제출할 수 없다', async function pendingCase() {
    renderForm(jest.fn(), true);

    expect(screen.getByRole('button', { name: '등록 중…' })).toBeDisabled();
  });

  describe('수정 모드', function editSuite() {
    it('시작값을 채운 채로 열리고 버튼 문구가 바뀐다', async function initialValuesCase() {
      renderEditForm(jest.fn());

      expect(screen.getByLabelText('제목')).toHaveValue('맥북 에어 M2');
      expect(screen.getByLabelText('가격')).toHaveValue('850000');
      expect(screen.getByRole('button', { name: '수정하기' })).toBeInTheDocument();
      // 이미 올라가 있던 사진은 파일 없이도 미리보기 자리를 차지한다.
      expect(screen.getByAltText('상품 사진 1')).toBeInTheDocument();
    });

    it('사진을 다 지우면 제출되지 않는다', async function removeAllImagesCase() {
      const handleSubmit = jest.fn();
      renderEditForm(handleSubmit);

      await userEvent.click(screen.getByRole('button', { name: '상품 사진 1 삭제' }));
      await userEvent.click(screen.getByRole('button', { name: '수정하기' }));

      expect(await screen.findByText('상품 사진을 최소 1장 올려 주세요.')).toBeInTheDocument();
      expect(handleSubmit).not.toHaveBeenCalled();
    });

    it('기존 사진과 새로 고른 사진을 순서대로 함께 넘긴다', async function mixedImagesCase() {
      const handleSubmit = jest.fn();
      renderEditForm(handleSubmit);

      await userEvent.upload(screen.getByLabelText('상품 사진 추가'), makeImageFile('new.jpg'));
      await userEvent.click(screen.getByRole('button', { name: '수정하기' }));

      await waitFor(function assertSubmitted() {
        expect(handleSubmit).toHaveBeenCalledTimes(1);
      });
      const values = handleSubmit.mock.calls[0][0];
      expect(values.images).toHaveLength(2);
      expect(values.images[0]).toEqual({
        kind: 'existing',
        url: 'https://example.supabase.co/a.jpg',
      });
      expect(values.images[1].kind).toBe('new');
    });
  });
});
