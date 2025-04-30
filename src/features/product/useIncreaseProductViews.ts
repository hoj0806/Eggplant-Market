import { useMutation } from "@tanstack/react-query";
import { incrementProductViews } from "../../services/apiProducts";

export function useIncreaseProductViews() {
  const {
    mutate: incrementViews,
    isPending: isIncrementing,
    error,
  } = useMutation({
    mutationFn: (productId: number) => incrementProductViews(productId),
  });

  return { incrementViews, isIncrementing, error };
}
