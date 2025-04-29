import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteMyPurchaseHistory } from "../../services/apiRequest";

export function useDeletePurchaseHistory() {
  const queryClient = useQueryClient();

  const { mutate: deletePurchaseHistory, isPending: isDeleting } = useMutation({
    mutationFn: deleteMyPurchaseHistory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchaseHistory"] });
    },
  });

  return {
    deletePurchaseHistory,
    isDeleting,
  };
}