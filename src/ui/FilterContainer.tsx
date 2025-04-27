import styled from "styled-components";
import FilterGrid from "./FilterGrid";
import CategotyFilter from "./CategoryFilter";
import PriceFilter from "./PriceFilter";

const Container = styled.div`
  padding-top: 2rem;

  width: 24.2rem;
  display: flex;
  flex-direction: column;
  gap: 2.4rem;
`;
const OnlySaleFilterLabel = styled.label<{ selected: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.8rem;
  font-size: 1.8rem;
  color: ${(props) => (props.selected ? "#000" : "#666")};
  border-radius: 2rem;
  border: none;
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s;

  input[type="radio"] {
    appearance: none;
    width: 2rem; /* 크기를 글씨체 크기에 맞게 조절 */
    height: 2rem; /* 크기를 글씨체 크기에 맞게 조절 */
    border: 1px solid #ccc;
    border-radius: 0.4rem; /* 살짝 둥근 사각형 */
    position: relative;
    transition: border-color 0.2s, background-color 0.2s;
  }

  input[type="radio"]:checked {
    background-color: #ff6f0f; /* 체크 시 배경색 주황색으로 */
    border-color: #ff6f0f; /* 테두리 색도 주황색으로 */
  }

  input[type="radio"]:checked::before {
    content: "";
    position: absolute;
    top: 4px; /* 크기에 맞춰 위치 조정 */
    left: 4px; /* 크기에 맞춰 위치 조정 */
    width: 0.8rem; /* 체크 크기 */
    height: 0.8rem; /* 체크 크기 */
    background-color: #fff; /* 체크 박스 안에 흰색 체크 */
    border-radius: 50%; /* 체크는 원형 */
  }

  &:hover input[type="radio"] {
    background-color: #e0e0e0; /* hover 시 배경색 회색으로 */
    border-color: #888;
  }
`;

const FilterTitle = styled.h1`
  font-weight: bold;
  font-size: 2.2rem;
`;

const FilterResetButon = styled.button`
  text-decoration-line: underline;
  font-size: 1.2rem;
`;
const FilterRow = styled.div`
  display: flex;
  justify-content: space-between;
`;
const FilterContainer = () => {
  return (
    <Container>
      <FilterRow>
        <FilterTitle>필터</FilterTitle>
        <FilterResetButon>초기화</FilterResetButon>
      </FilterRow>
      <OnlySaleFilterLabel>
        <input type='radio' name='category' />
        거래 가능만 보기
      </OnlySaleFilterLabel>
      <FilterGrid title='카테고리'>
        <CategotyFilter />
      </FilterGrid>
      <FilterGrid title='가격'>
        <PriceFilter />
      </FilterGrid>
    </Container>
  );
};

export default FilterContainer;
