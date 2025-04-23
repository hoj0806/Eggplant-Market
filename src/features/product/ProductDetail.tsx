import { useProduct } from "./useProduct";

const ProductDetail = () => {
  const { product, isLoading } = useProduct();

  if (isLoading) return <p>상품정보를 불러오고 있습니다...</p>;

  return <div>{product.id}</div>;
};

export default ProductDetail;
