import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createRequest as createRequestApi } from "../../services/apiRequest";
import { useParams } from "react-router-dom";
import { useUser } from "../authentication/useUser";

export function useCreateRequest() {
  const queryClient = useQueryClient();
  const params = useParams();
  const { user } = useUser();
  const { mutate: createRequest, isPending: isCreating } = useMutation({
    mutationFn: createRequestApi,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["request", params.productId, user?.id],
      });
    },
  });

  return { createRequest, isCreating };
}
