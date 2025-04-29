import supabase from "../supabase";

interface RequestData {
  productId: string;
  sellerId: string;
}

export async function createRequest({ productId, sellerId }: RequestData) {
  const { data, error } = await supabase
    .from("purchase_requests")
    .insert([{ product_id: productId, seller_id: sellerId }]);

  if (error) {
    console.error("구매 요청 생성 중 오류가 발생했습니다:", error);
    throw error;
  }

  return data;
}

export async function getPendingRequestByProductAndBuyer(
  productId: string,
  buyerId: string
) {
  const { data, error } = await supabase
    .from("purchase_requests")
    .select("*")
    .eq("product_id", productId)
    .eq("buyer_id", buyerId);

  if (error) {
    throw new Error(`요청을 가져오는 데 실패했습니다: ${error.message}`);
  }

  return data;
}

export async function getSentRequests(currentUserId: string) {
  const { data, error } = await supabase
    .from("purchase_requests")
    .select("*")
    .eq("buyer_id", currentUserId);

  if (error) {
    throw new Error(`요청을 가져오는 데 실패했습니다: ${error.message}`);
  }

  return data;
}

export async function getReceivedRequests(currentUserId: string) {
  const { data, error } = await supabase
    .from("purchase_requests")
    .select("*")
    .eq("seller_id", currentUserId);

  if (error) {
    throw new Error(`받은 요청을 가져오는 데 실패했습니다: ${error.message}`);
  }

  return data;
}
export async function cancelRequest({
  product_id,
  buyer_id,
}: {
  product_id: string;
  buyer_id: string;
}) {
  const { data, error } = await supabase
    .from("purchase_requests")
    .delete()
    .eq("buyer_id", buyer_id)
    .eq("product_id", product_id);

  if (error) {
    console.error("요청 삭제 중 오류가 발생했습니다:", error);
    throw error;
  }

  return data; // 삭제된 데이터 반환
}

export async function acceptRequest(data) {
  // Step 1: 요청 수락
  console.log("acceptRequest 호출됨:", data);

  const { data: updatedData, error: updateError } = await supabase
    .from("purchase_requests")
    .update({ status: "accepted" })
    .eq("id", data.requestId);

  if (updateError) {
    console.error("요청 수락 중 오류가 발생했습니다:", updateError);
    throw updateError;
  }

  // Step 2: 다른 요청 삭제
  const { error: deleteError } = await supabase
    .from("purchase_requests")
    .delete()
    .eq("product_id", data.productId)
    .neq("id", data.requestId); // 현재 수락한 요청은 제외하고 삭제

  if (deleteError) {
    console.error("다른 요청 삭제 중 오류가 발생했습니다:", deleteError);
    throw deleteError;
  }

  return updatedData;
}

export async function markRequestAsCompleted(data) {
  // Step 1: 요청 삭제
  const { data: requestData, error: requestError } = await supabase
    .from("purchase_requests")
    .delete()
    .eq("id", data.requestId);

  if (requestError) {
    console.error("요청 삭제 중 오류가 발생했습니다:", requestError);
    throw requestError;
  }

  // Step 2: products 테이블에서 해당 상품의 isSold 값을 true로 변경
  const { data: productData, error: productError } = await supabase
    .from("products")
    .update({ isSold: true })
    .eq("id", data.productId);

  if (productError) {
    console.error(
      "상품 판매 상태 업데이트 중 오류가 발생했습니다:",
      productError
    );
    throw productError;
  }

  return { requestData, productData }; // 삭제된 요청 데이터와 상품 데이터 반환
}
