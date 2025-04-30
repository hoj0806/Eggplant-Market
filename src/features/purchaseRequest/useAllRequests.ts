import { useQuery } from "@tanstack/react-query";
import { getAllProductRequests } from "../../services/apiRequest";
import { useParams } from "react-router-dom";

interface RequestParams {
  productId: string;
  buyerId: string;
}
const useAllRequests = ({ productId }: RequestParams) => {
  const params = useParams();

  const { data: request, isLoading } = useQuery({
    queryKey: ["request", params.productId],
    queryFn: () => getAllProductRequests({ productId }),
  });

  return { request, isLoading };
};

export default useAllRequests;
