import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteProduct as deleteProductApi } from "../../services/apiProducts";
import { useNavigate } from "react-router-dom";

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { isPending: isDeleting, mutate: deleteProduct } = useMutation({
    mutationFn: deleteProductApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      navigate("/");
    },
    onError: (err) => {
      console.log(err.message);
    },
  });

  return {
    isDeleting,
    deleteProduct,
  };
}
