import TextField from '../../../shared/ui/textField';
import { MIN_REGION_QUERY_LENGTH } from '../hooks/useRegionSearch';

type RegionSearchFieldProps = {
  value: string;
  disabled: boolean;
  onValueChange(value: string): void;
};

/**
 * 동네 이름 검색 입력.
 * form으로 감싸지 않는다 — 이 컴포넌트는 온보딩 폼 안에 들어가고, form 중첩은 유효하지 않다.
 * 입력이 잠잠해지면 알아서 검색되므로 Enter로 제출할 일도 없다.
 */
function RegionSearchField(props: RegionSearchFieldProps) {
  return (
    <TextField
      id="regionQuery"
      label="동네 이름으로 찾기"
      value={props.value}
      placeholder="예: 수유동"
      description={`동 이름을 ${MIN_REGION_QUERY_LENGTH}자 이상 입력하면 검색합니다.`}
      autoComplete="off"
      disabled={props.disabled}
      onValueChange={props.onValueChange}
    />
  );
}

export default RegionSearchField;
