import { useMutation } from "@tanstack/react-query";
import { rejectRequest as rejectRequestApi } from "../../services/apiRequest";

export function useRejectRequest() {
  const { mutate: rejectRequest, isPending: isRejecting } = useMutation({
    mutationFn: rejectRequestApi,
  });

  return {
    rejectRequest,
    isRejecting,
  };
}
