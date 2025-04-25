import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import styled from "styled-components";
import { useProduct } from "../features/product/useProduct";

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
  width: 25rem;
  flex-shrink: 0;
  padding: 2rem;
  background-color: #f9f9f9;
  border-radius: 1.2rem;
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
`;

const CategoryLabel = styled.label<{ selected: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.4rem;
  background-color: ${(props) => (props.selected ? "#ffe5cc" : "white")};
  padding: 0.6rem 1rem;
  border-radius: 2rem;
  border: 1px solid #ccc;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background-color: #f0f0f0;
  }

  input {
    display: none;
  }
`;

const CategotyFilter = () => {
  const { product } = useProduct();
  const [categoryParams, setCategoryParams] = useSearchParams();
  const [selectedCategory, setSelectedCategory] = useState(
    categoryParams.get("category") || ""
  );

  const handleChangeCategory = (cat: string) => {
    setSelectedCategory(cat);
    categoryParams.set("category", cat);
    setCategoryParams(categoryParams);
    product("sdf");
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
