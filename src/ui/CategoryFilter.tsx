import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import styled from "styled-components";
import FilterGrid from "./FilterGrid";

const categories = [
  "디지털기기",
  "생활가전",
  "가구/인테리어",
  "생활/주방",
  "유아동",
  "유아도서",
  "여성의류",
  "여성잡화",
  "남성패션/잡화",
  "뷰티/미용",
  "스포츠/레저",
  "취미/게임/음반",
  "도서",
  "티켓/교환권",
  "가공식품",
  "건강기능식품",
  "반려동물용품",
  "식물",
  "기타 중고물품",
];

const StyledFilterContainer = styled.div`
  background-color: #f9f9f9;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
`;

const CategoryLabel = styled.label<{ selected: boolean }>`
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 1.6rem;
  color: ${(props) => (props.selected ? "#000" : "#666")};

  border-radius: 2rem;
  border: none;
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s;

  &:hover {
    color: #888;
  }

  input[type="radio"] {
    appearance: none;
    width: 1.4rem;
    height: 1.4rem;
    border: 2px solid #ccc;
    border-radius: 50%;
    position: relative;
    transition: border-color 0.2s;
  }

  input[type="radio"]:checked {
    border-color: #ff6f0f;
  }

  input[type="radio"]:checked::before {
    content: "";
    position: absolute;
    top: 2px;
    left: 2px;
    width: 0.6rem;
    height: 0.6rem;
    background-color: #ff6f0f;
    border-radius: 50%;
  }

  &:hover input[type="radio"] {
    border-color: #888;
  }

  &:hover input[type="radio"]:checked::before {
    background-color: #888;
  }
`;
const CategotyFilter = () => {
  const [categoryParams, setCategoryParams] = useSearchParams();
  const [selectedCategory, setSelectedCategory] = useState(
    categoryParams.get("category") || ""
  );

  const handleChangeCategory = (cat: string) => {
    setSelectedCategory(cat);
    categoryParams.set("category", cat);
    setCategoryParams(categoryParams);
  };
  return (
    <StyledFilterContainer>
      {categories.map((category) => (
        <CategoryLabel key={category} selected={selectedCategory === category}>
          <input
            type='radio'
            name='category'
            checked={selectedCategory === category}
            onChange={() => handleChangeCategory(category)}
          />
          {category}
        </CategoryLabel>
      ))}
    </StyledFilterContainer>
  );
};

export default CategotyFilter;
