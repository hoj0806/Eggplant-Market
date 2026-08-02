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
import type { PostFieldErrors, PostFormValues } from '../types';

type PostFormProps = {
  /** 거래희망장소 검색의 중심. 사용자 동네 좌표를 넘긴다. */
  center: RegionCoords | null;
  isPending: boolean;
  onSubmit(values: PostFormValues): void;
};

const EMPTY_VALUES: PostFormValues = {
  title: '',
  description: '',
  price: '',
  categoryId: null,
  imageFiles: [],
  tradePlace: null,
};

function PostForm(props: PostFormProps) {
  const [values, setValues] = useState<PostFormValues>(EMPTY_VALUES);
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

  function handleImagesChange(imageFiles: File[]): void {
    updateValue('imageFiles', imageFiles);
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
        files={values.imageFiles}
        errorMessage={errors.imageFiles}
        disabled={props.isPending}
        onFilesChange={handleImagesChange}
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

      <SubmitButton label="등록하기" pendingLabel="등록 중…" isPending={props.isPending} />
    </form>
  );
}

export default PostForm;
