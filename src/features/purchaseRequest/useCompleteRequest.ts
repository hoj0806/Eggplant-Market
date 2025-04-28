import { useMutation } from "@tanstack/react-query";
import { markRequestAsCompleted as markRequestAsCompletedApi } from "../../services/apiRequest";

export function useCompleteRequest() {
  const { mutate: completeRequest, isPending: isCompleting } = useMutation({
    mutationFn: markRequestAsCompletedApi,
  });

  return {
    completeRequest,
    isCompleting,
  };
}
