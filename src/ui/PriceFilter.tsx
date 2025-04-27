import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import styled from "styled-components";

const prices = ["0_5000", "0_10000", "0_20000"];

const StyledFilterContainer = styled.div`
  width: 25rem;
  flex-shrink: 0;
  background-color: #f9f9f9;
  border-radius: 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
`;

const PriceLabel = styled.label<{ selected: boolean }>`
  font-size: 1.4rem;
  background-color: ${(props) => (props.selected ? "#ffe5cc" : "white")};
  padding: 0.6rem 1rem;
  border-radius: 2rem;
  border: 1px solid #ccc;
  transition: all 0.2s;
  cursor: pointer;
  display: inline-block;
  width: auto;

  &:hover {
    background-color: #f0f0f0;
  }

  input {
    display: none;
  }
`;

const InputGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 1rem;
`;

const PriceInput = styled.input`
  width: 6rem;
  padding: 0.5rem;
  font-size: 1.4rem;
  border-radius: 0.6rem;
  border: 1px solid #ccc;
  /* 숫자 입력 시, 위아래 버튼 없애기 */
  -moz-appearance: textfield; /* Firefox */
  -webkit-appearance: none; /* Chrome, Safari */
  appearance: none; /* Standard */

  /* 위아래 버튼 없애기 (Webkit 기반 브라우저) */
  &::-webkit-outer-spin-button,
  &::-webkit-inner-spin-button {
    appearance: none;
    margin: 0;
  }
`;

const Dash = styled.span`
  font-size: 1.4rem;
`;

const ApplyButton = styled.button`
  background: none;
  border: none;
  font-size: 1.4rem;
  padding: 0.2rem;
  text-decoration: underline;
  text-align: left;
  cursor: pointer;

  &:hover {
    color: #e65c0f;
  }
`;

const ShareButton = styled(PriceLabel)`
  background-color: ${(props) => (props.selected ? "#ffe5cc" : "white")};
  cursor: pointer;
  display: inline-block;
  width: auto;
  text-align: center;
`;

const PriceFilter = () => {
  const [priceParams, setPriceParams] = useSearchParams();
  const [selectedPrice, setSelectedPrice] = useState(
    priceParams.get("price") || ""
  );
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [selectedShare, setSelectedShare] = useState(false);

  const handleChangePrice = (pri: string) => {
    setSelectedPrice(pri);
    priceParams.set("price", pri);
    setPriceParams(priceParams);
  };

  const handleApplyFilter = () => {
    if (minPrice && maxPrice) {
      const combinedPrice = `${minPrice}_${maxPrice}`;
      priceParams.set("price", combinedPrice);
      setPriceParams(priceParams);
    }
  };

  const handleShareClick = () => {
    setSelectedShare(!selectedShare);
    priceParams.set("price", "0_0");
    setPriceParams(priceParams);
  };

  return (
    <StyledFilterContainer>
      <ShareButton selected={selectedShare} onClick={handleShareClick}>
        나눔
      </ShareButton>
      {prices.map((price) => (
        <PriceLabel key={price} selected={selectedPrice === price}>
          <input
            type='radio'
            name='price'
            checked={selectedPrice === price}
            onChange={() => handleChangePrice(price)}
          />
          {price.split("_")[1]}원 이하
        </PriceLabel>
      ))}
      <InputGroup>
        <PriceInput
          type='number'
          value={minPrice}
          onChange={(e) => setMinPrice(e.target.value)}
        />
        <Dash>-</Dash>
        <PriceInput
          type='number'
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value)}
        />
      </InputGroup>
      <ApplyButton onClick={handleApplyFilter}>적용하기</ApplyButton>
    </StyledFilterContainer>
  );
};

export default PriceFilter;
