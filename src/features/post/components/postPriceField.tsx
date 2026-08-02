import TextField from '../../../shared/ui/textField';
import { formatPrice } from '../../../shared/utils/formatPrice';

type PostPriceFieldProps = {
  value: string;
  errorMessage?: string;
  disabled?: boolean;
  onValueChange(value: string): void;
};

const FREE_PRICE = '0';

/** 화면에는 숫자만 남긴다. 붙여넣기로 들어온 "1,200원"도 여기서 걸러진다. */
function toDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * 가격 입력. 0원은 오류가 아니라 "나눔"이라서 체크박스로 한 번에 고를 수 있게 했다.
 * 실제 검증은 validatePostPrice가 맡는다 — 여기서 거르는 것은 입력 편의일 뿐이다.
 */
function PostPriceField(props: PostPriceFieldProps) {
  const digits = toDigits(props.value);
  const isFree = digits === FREE_PRICE;

  function handleValueChange(next: string): void {
    props.onValueChange(toDigits(next));
  }

  function handleFreeToggle(): void {
    props.onValueChange(isFree ? '' : FREE_PRICE);
  }

  return (
    <div className="flex flex-col gap-2">
      <TextField
        id="price"
        label="가격"
        value={props.value}
        placeholder="숫자만 입력"
        description={
          digits.length > 0 ? `${formatPrice(Number(digits))}으로 등록됩니다.` : undefined
        }
        errorMessage={props.errorMessage}
        disabled={props.disabled === true || isFree}
        autoComplete="off"
        onValueChange={handleValueChange}
      />

      <label className="flex w-fit items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
        <input
          type="checkbox"
          checked={isFree}
          disabled={props.disabled === true}
          onChange={handleFreeToggle}
          className="h-4 w-4 accent-emerald-600"
        />
        무료로 나눔할게요
      </label>
    </div>
  );
}

export default PostPriceField;
