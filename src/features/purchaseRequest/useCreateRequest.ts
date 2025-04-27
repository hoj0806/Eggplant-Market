import { useMutation } from "@tanstack/react-query";
import { createRequest as createRequestApi } from "../../services/apiRequest";

export function useCreateRequest() {
  const { mutate: createRequest, isPending: isCreating } = useMutation({
    mutationFn: createRequestApi,
  });

  return { createRequest, isCreating };
}
