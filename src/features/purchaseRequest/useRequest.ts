import { useQuery } from "@tanstack/react-query";
import { getProductRequest } from "../../services/apiRequest";
import { useParams } from "react-router-dom";
import { useUser } from "../authentication/useUser";

interface RequestParams {
  productId: string;
  buyerId: string;
}
const useRequest = ({ productId, buyerId }: RequestParams) => {
  const params = useParams();
  const { user } = useUser();

  const { data: request, isLoading } = useQuery({
    queryKey: ["request", params.productId, user?.id],
    queryFn: () => getProductRequest({ productId, buyerId }),
  });

  return { request, isLoading };
};

export default useRequest;
