import { useProducts } from "./useProducts";

const ProductGrid = () => {
  const { products, isPending } = useProducts();

  if (isPending) return <div>게시물을 가져오는 중입니다...</div>;
  console.log(products);
  return (
    <div>
      {products?.map((product) => {
        return <div key={product.id}>{product.postTitle}</div>;
      })}
    </div>
  );
};

export default ProductGrid;
