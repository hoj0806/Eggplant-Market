import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addToWishlist } from "../../services/apiWishlist";

export function useAddToWishlist() {
  const queryClient = useQueryClient();

  const { mutate: addWishlist, isPending: isAdding } = useMutation({
    mutationFn: addToWishlist,
    onSuccess: () => {
      // 찜 추가 후 wishlists 쿼리를 새로고침
      queryClient.invalidateQueries({ queryKey: ["wishlists"] });
    },
  });

  return { addWishlist, isAdding };
}
