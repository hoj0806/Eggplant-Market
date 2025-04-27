import { useMutation } from "@tanstack/react-query";
import { deleteRequest } from "../../services/apiRequest";

export function useDeleteRequest() {
  const { mutate: deleteRequestMutation, isPending: isDeleting } = useMutation({
    mutationFn: deleteRequest,
  });

  return { deleteRequestMutation, isDeleting };
}
