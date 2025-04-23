import { useParams } from "react-router-dom";
import { useProduct } from "./useProduct";
import { useDeleteProduct } from "./useDeleteProduct";

const ProductDetail = () => {
  const { product, isLoading } = useProduct();
  const { deleteProduct, isDeleting } = useDeleteProduct();
  const params = useParams();

  const handleDeleteProduct = () => {
    deleteProduct(params.productId);
  };

  if (isLoading) return <p>상품정보를 불러오고 있습니다...</p>;

  return (
    <div>
      <h1>{product.id}</h1>
      <button disabled={isDeleting} onClick={handleDeleteProduct}>
        {isDeleting ? "삭제중입니다..." : "글 삭제하기"}
      </button>
    </div>
  );
};

export default ProductDetail;
