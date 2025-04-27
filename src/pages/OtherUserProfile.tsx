import { Link, useParams } from "react-router-dom";
import { useUserProducts } from "../features/product/useUserProducts";
import styled from "styled-components";
import OtherProduct from "../features/product/OtherProduct";

const MainContainer = styled.div`
  h1 {
    font-size: 2.4rem;
  }
`;

const ProductGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(6, 1fr); /* 6 columns */
  gap: 1rem; /* space between grid items */
`;

const OtherUserProfile = () => {
  const params = useParams();
  const { isPending, userProducts } = useUserProducts(params.userId);

  if (isPending) return <div>로딩중입니다...</div>;

  return (
    <MainContainer>
      <h1>판매물품({userProducts.length})</h1>
      <ProductGrid>
        {userProducts?.map((product) => {
          return (
            <Link to={`/product/${product.id}`} key={product.id}>
              <OtherProduct
                title={product.postTitle}
                price={product.price}
                image={JSON.parse(product.image)[0]}
              />
            </Link>
          );
        })}
      </ProductGrid>
    </MainContainer>
  );
};

export default OtherUserProfile;
