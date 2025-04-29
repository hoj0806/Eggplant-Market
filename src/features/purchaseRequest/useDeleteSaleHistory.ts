import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteMySaleHistory } from "../../services/apiRequest";
export function useDeleteSaleHistory() {
  const queryClient = useQueryClient();
  const { mutate: deleteSaleHistory, isPending: isDeleting } = useMutation({
    mutationFn: deleteMySaleHistory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saleHistory"] });
    },
  });

  return {
    deleteSaleHistory,
    isDeleting,
  };
}
