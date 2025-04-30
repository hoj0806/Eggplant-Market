import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addToWishlist } from "../../services/apiWishlist";

export function useAddToWishlist() {
  const queryClient = useQueryClient();

  const { mutate: addWishlist, isPending: isAdding } = useMutation({
    mutationFn: addToWishlist,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlists"] });
    },
  });

  return { addWishlist, isAdding };
}
