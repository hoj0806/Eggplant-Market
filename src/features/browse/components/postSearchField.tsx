import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useDebouncedValue } from '../../../shared/hooks/useDebouncedValue';

type PostSearchFieldProps = {
  /** URL에 적용돼 있는 검색어. 뒤로가기로 값이 바뀌면 입력창도 따라와야 한다. */
  keyword: string;
  onKeywordChange(keyword: string): void;
};

const SEARCH_DEBOUNCE_MS = 400;
const FIELD_ID = 'postSearchKeyword';

/**
 * 제품 이름·게시물 내용 검색 입력.
 *
 * 타이핑이 잠잠해지면 알아서 검색한다. 한 글자마다 요청하면 "노트북"을 치는 동안
 * 세 번을 헛돈다. Enter는 기다리지 않고 바로 검색하는 지름길이다.
 */
function PostSearchField(props: PostSearchFieldProps) {
  const [text, setText] = useState(props.keyword);
  const debouncedText = useDebouncedValue(text, SEARCH_DEBOUNCE_MS);

  // 부모에게 알린 마지막 값. 이것 없이 debouncedText만 보면
  // 뒤로가기로 keyword가 바뀌었을 때 부모에게 옛 값을 되돌려 보낸다.
  const appliedRef = useRef(props.keyword);

  useEffect(
    function syncFromUrl() {
      if (props.keyword !== appliedRef.current) {
        appliedRef.current = props.keyword;
        setText(props.keyword);
      }
    },
    [props.keyword],
  );

  // 부모가 렌더마다 새 함수를 넘겨도 디바운스가 다시 시작되지 않도록 ref로 들고 있는다.
  const onKeywordChangeRef = useRef(props.onKeywordChange);
  onKeywordChangeRef.current = props.onKeywordChange;

  useEffect(
    function applyDebounced() {
      const trimmed = debouncedText.trim();

      if (trimmed === appliedRef.current) {
        return;
      }

      appliedRef.current = trimmed;
      onKeywordChangeRef.current(trimmed);
    },
    [debouncedText],
  );

  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    setText(event.target.value);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    // 디바운스를 기다리지 않고 즉시 적용한다.
    event.preventDefault();

    const trimmed = text.trim();
    if (trimmed !== appliedRef.current) {
      appliedRef.current = trimmed;
      onKeywordChangeRef.current(trimmed);
    }
  }

  return (
    <form role="search" onSubmit={handleSubmit}>
      <label htmlFor={FIELD_ID} className="sr-only">
        물건 검색
      </label>
      <input
        id={FIELD_ID}
        name={FIELD_ID}
        type="search"
        autoComplete="off"
        placeholder="물건 이름이나 내용으로 검색"
        value={text}
        onChange={handleChange}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm
                   text-gray-900 outline-none transition placeholder:text-gray-400
                   focus:ring-2 focus:ring-emerald-500/40
                   dark:border-gray-700 dark:bg-gray-900 dark:text-gray-50
                   dark:placeholder:text-gray-500"
      />
    </form>
  );
}

export default PostSearchField;
