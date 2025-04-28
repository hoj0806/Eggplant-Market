import React from "react";
import styled from "styled-components";

// Props 인터페이스 정의
interface OtherProductProps {
  title: string;
  price: string;
  image: string;
}

const ProductContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  flex-grow: 1;
  font-size: 2.4rem;
`;

const ImageContainer = styled.img`
  width: 19rem;
  height: 19rem;
  border-radius: 1rem; // 살짝 둥근 모서리 추가
  object-fit: cover; // 이미지 비율 유지하며 자르기
`;

const OtherProduct: React.FC<OtherProductProps> = ({ title, price, image }) => {
  return (
    <ProductContainer>
      <ImageContainer src={image} alt={title} />
      <h2>{title}</h2>
      <p>{price}</p>
    </ProductContainer>
  );
};

export default OtherProduct;
