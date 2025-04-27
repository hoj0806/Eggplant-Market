import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteRequest } from "../../services/apiRequest";

export function useDeleteRequest() {
  const queryClient = useQueryClient();

  const { mutate: deleteRequestMutation, isPending: isDeleting } = useMutation({
    mutationFn: deleteRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sentRequest"] });
    },
  });

  return { deleteRequestMutation, isDeleting };
}
