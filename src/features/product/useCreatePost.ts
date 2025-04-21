import { useMutation } from "@tanstack/react-query";
import { createProductPost as createProductPostApi } from "../../services/apiProducts";

export function useCreatePost() {
  const { mutate: createProductPost } = useMutation({
    mutationFn: createProductPostApi,
  });

  return { createProductPost };
}
