import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import styled from "styled-components";

const prices = ["0_5000", "0_10000", "0_20000"];
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

const PriceLabel = styled.label<{ selected: boolean }>`
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

const PriceFilter = () => {
  const [priceParams, setPriceParams] = useSearchParams();
  const [selectedPrice, setSelectedPrice] = useState(
    priceParams.get("price") || ""
  );

  const handleChangePrie = (pri: string) => {
    setSelectedPrice(pri);
    priceParams.set("price", pri);
    setPriceParams(priceParams);
  };

  return (
    <StyledFilterContainer>
      {prices.map((price) => (
        <PriceLabel key={price} selected={selectedPrice === price}>
          <input
            type='radio'
            name='category'
            checked={selectedPrice === price}
            onChange={() => handleChangePrie(price)}
          />
          {price.split("_")[1]}원 이하
        </PriceLabel>
      ))}
    </StyledFilterContainer>
  );
};

export default PriceFilter;
