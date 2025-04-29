import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteFromWishlist } from "../../services/apiWishlist";

export function useDeleteFromWishlist() {
  const queryClient = useQueryClient();

  const { mutate: deleteWishlist, isPending: isDeleting } = useMutation({
    mutationFn: deleteFromWishlist,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlists"] });
    },
  });

  return { deleteWishlist, isDeleting };
}