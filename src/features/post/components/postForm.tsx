import { useState, type FormEvent, type KeyboardEvent } from 'react';
import PostImagePicker from './postImagePicker';
import PostPriceField from './postPriceField';
import SubmitButton from '../../../shared/ui/submitButton';
import TextArea from '../../../shared/ui/textArea';
import TextField from '../../../shared/ui/textField';
import CategorySelect from '../../category/components/categorySelect';
import TradePlacePicker from '../../place/components/tradePlacePicker';
import { hasPostFieldError, validatePostFormValues } from '../utils/validatePostInput';
import type { TradePlace } from '../../place/types';
import type { RegionCoords } from '../../region/types';
import type { PostFieldErrors, PostFormValues, PostImageItem } from '../types';

/** 등록과 수정은 같은 폼이다. 다른 것은 버튼 문구와 시작값뿐이다. */
export type PostFormMode = 'create' | 'edit';

type PostFormProps = {
  mode: PostFormMode;
  /** 거래희망장소 검색의 중심. 사용자 동네 좌표를 넘긴다. */
  center: RegionCoords | null;
  /** 수정 화면이 넘기는 시작값. 등록에서는 넘기지 않는다. */
  initialValues?: PostFormValues;
  isPending: boolean;
  onSubmit(values: PostFormValues): void;
};

const EMPTY_VALUES: PostFormValues = {
  title: '',
  description: '',
  price: '',
  categoryId: null,
  images: [],
  tradePlace: null,
};

const SUBMIT_LABEL: Record<PostFormMode, { idle: string; pending: string }> = {
  create: { idle: '등록하기', pending: '등록 중…' },
  edit: { idle: '수정하기', pending: '수정 중…' },
};

function PostForm(props: PostFormProps) {
  // 시작값은 첫 렌더에서 한 번만 읽는다. 저장 중 상세 캐시가 갱신돼 새 객체가 내려와도
  // 사용자가 입력하던 내용을 되돌려서는 안 된다.
  const [values, setValues] = useState<PostFormValues>(props.initialValues ?? EMPTY_VALUES);
  const [errors, setErrors] = useState<PostFieldErrors>({});

  /** 고친 필드의 오류 문구는 즉시 지운다. 고쳤는데도 빨간 글씨가 남아 있으면 혼란스럽다. */
  function updateValue<Key extends keyof PostFormValues>(
    key: Key,
    value: PostFormValues[Key],
  ): void {
    setValues(function mergeValue(previous: PostFormValues): PostFormValues {
      return { ...previous, [key]: value };
    });
    setErrors(function clearFieldError(previous: PostFieldErrors): PostFieldErrors {
      if (key === 'tradePlace') {
        return previous;
      }
      const next = { ...previous };
      delete next[key as keyof PostFieldErrors];
      return next;
    });
  }

  function handleTitleChange(title: string): void {
    updateValue('title', title);
  }

  function handleDescriptionChange(description: string): void {
    updateValue('description', description);
  }

  function handlePriceChange(price: string): void {
    updateValue('price', price);
  }

  function handleCategoryChange(categoryId: number | null): void {
    updateValue('categoryId', categoryId);
  }

  function handleImagesChange(images: PostImageItem[]): void {
    updateValue('images', images);
  }

  function handleTradePlaceChange(tradePlace: TradePlace | null): void {
    updateValue('tradePlace', tradePlace);
  }

  /**
   * 폼 안에 검색 입력(장소)이 있어서 Enter가 곧바로 등록으로 이어질 수 있다.
   * 사진도 다 고르기 전에 글이 올라가는 사고를 막으려고 한 줄 입력에서의 Enter는 삼킨다.
   * 등록은 버튼으로만 한다. 여러 줄 입력(textarea)의 줄바꿈은 그대로 둔다.
   */
  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>): void {
    const target = event.target as HTMLElement;
    if (event.key === 'Enter' && target.tagName === 'INPUT') {
      event.preventDefault();
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    const nextErrors = validatePostFormValues(values);
    setErrors(nextErrors);

    if (hasPostFieldError(nextErrors)) {
      return;
    }

    props.onSubmit(values);
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
      <PostImagePicker
        images={values.images}
        errorMessage={errors.images}
        disabled={props.isPending}
        onImagesChange={handleImagesChange}
      />

      <TextField
        id="title"
        label="제목"
        value={values.title}
        placeholder="예: 아이패드 프로 11인치 3세대"
        maxLength={40}
        errorMessage={errors.title}
        disabled={props.isPending}
        autoComplete="off"
        onValueChange={handleTitleChange}
      />

      <CategorySelect
        value={values.categoryId}
        errorMessage={errors.categoryId}
        disabled={props.isPending}
        onChange={handleCategoryChange}
      />

      <PostPriceField
        value={values.price}
        errorMessage={errors.price}
        disabled={props.isPending}
        onValueChange={handlePriceChange}
      />

      <TextArea
        id="description"
        label="상품 설명"
        value={values.description}
        placeholder="상품의 상태, 구입 시기, 사용 기간 등을 적어 주세요."
        maxLength={2000}
        errorMessage={errors.description}
        disabled={props.isPending}
        onValueChange={handleDescriptionChange}
      />

      <TradePlacePicker
        value={values.tradePlace}
        center={props.center}
        disabled={props.isPending}
        onChange={handleTradePlaceChange}
      />

      <SubmitButton
        label={SUBMIT_LABEL[props.mode].idle}
        pendingLabel={SUBMIT_LABEL[props.mode].pending}
        isPending={props.isPending}
      />
    </form>
  );
}

export default PostForm;
