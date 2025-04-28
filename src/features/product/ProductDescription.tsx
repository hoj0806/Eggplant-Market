import styled from "styled-components";
import { useProduct } from "./useProduct";

const DescriptionContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3rem;

  & h1 {
    font-size: 3rem;
    font-weight: bold;
  }

  & p {
    font-size: 2.4rem;
  }
`;
const PostDescription = () => {
  const { product } = useProduct();
  return (
    <DescriptionContainer>
      <h1>{product.postTitle}</h1>
      <p>{product.category}</p>
      <p>{product.price}원</p>
      <p>{product.description}</p>
    </DescriptionContainer>
  );
};

export default PostDescription;
