import styled from "styled-components";
import { useUser } from "../features/authentication/useUser";
import { useUserProducts } from "../features/product/useUserProducts";
import { Link } from "react-router-dom";
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

const MyPosts = () => {
  const { user, isLoading } = useUser();
  const { isPending, userProducts } = useUserProducts(user?.id);
  if (isLoading || isPending) return <div>로딩중...</div>;
  console.log(user, userProducts);
  return (
    <MainContainer>
      <h1>판매물품({userProducts?.length})</h1>
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

export default MyPosts;
