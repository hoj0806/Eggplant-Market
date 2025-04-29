import { useQuery } from "@tanstack/react-query";
import { useUser } from "../authentication/useUser";
import { getMyWishList } from "../../services/apiWishlist";

export function useMyWishlists(productId?: string) {
  const { user } = useUser();

  const {
    data: myWishlists,
    isPending: isLoading,
    error,
  } = useQuery({
    queryKey: ["wishlists", user?.id, productId],
    queryFn: () => getMyWishList(user!.id, productId),
  });

  return {
    myWishlists,
    isLoading,
    error,
  };
}
