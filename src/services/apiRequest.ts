import supabase from "../supabase";

interface RequestData {
  productId: string;
  sellerId: string;
}

export async function getProductRequest({
  productId,
  buyerId,
}: {
  productId: string;
  buyerId: string;
}) {
  const { data, error } = await supabase
    .from("purchase_requests")
    .select("*")
    .eq("product_id", productId)
    .eq("buyer_id", buyerId);

  if (error) {
    throw new Error(error.message);
  }
  return data;
}

export async function getAllProductRequests({
  productId,
}: {
  productId: string;
}) {
  const { data, error } = await supabase
    .from("purchase_requests")
    .select("*")
    .eq("product_id", productId);

  if (error) {
    throw new Error(error.message);
  }
  return data;
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

export async function cancelRequest({
  productId,
  buyerId,
}: {
  productId: string;
  buyerId: string;
}) {
  const { data, error } = await supabase
    .from("purchase_requests")
    .delete()
    .eq("product_id", productId)
    .eq("buyer_id", buyerId);

  if (error) {
    console.error("요청 삭제 중 오류가 발생했습니다:", error);
    throw error;
  }

  return data; // 삭제된 데이터 반환
}

export async function getSentRequests(currentUserId: string) {
  const { data, error } = await supabase
    .from("purchase_requests")
    .select("*")
    .eq("buyer_id", currentUserId)
    .neq("status", "completed");

  if (error) {
    throw new Error(`요청을 가져오는 데 실패했습니다: ${error.message}`);
  }

  return data;
}

export async function getReceivedRequests(currentUserId: string) {
  const { data, error } = await supabase
    .from("purchase_requests")
    .select("*")
    .eq("seller_id", currentUserId)
    .neq("status", "completed");

  if (error) {
    throw new Error(`받은 요청을 가져오는 데 실패했습니다: ${error.message}`);
  }

  return data;
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

  const { error: productError } = await supabase
    .from("products")
    .update({ status: "reserved" })
    .eq("id", data.productId);

  if (productError) {
    throw productError;
  }

  return updatedData;
}

export async function markRequestAsCompleted(data) {
  // Step 1: 요청 상태를 'completed'로 변경
  const { data: requestData, error: requestError } = await supabase
    .from("purchase_requests")
    .update({ status: "completed" })
    .eq("id", data.requestId);

  if (requestError) {
    console.error("요청 완료 상태 변경 중 오류가 발생했습니다:", requestError);
    throw requestError;
  }

  // Step 2: products 테이블에서 해당 상품의 isSold 값을 true로 변경
  const { data: productData, error: productError } = await supabase
    .from("products")
    .update({ status: "soldOut" })
    .eq("id", data.productId);

  if (productError) {
    console.error(
      "상품 판매 상태 업데이트 중 오류가 발생했습니다:",
      productError
    );
    throw productError;
  }

  return { requestData, productData }; // 상태 변경된 데이터 반환
}

export async function getMySalesHistory(id: string) {
  const { data, error } = await supabase
    .from("purchase_requests")
    .select("*")
    .eq("status", "completed")
    .eq("seller_id", id)
    .neq("isSellerDeleted", true); // 삭제된 판매 기록 제외

  if (error) {
    console.error("판매 기록 가져오는 중 오류:", error);
    throw error;
  }

  return data;
}

export async function getMyPurchaseHistory(id: string) {
  const { data: purchaseHistory, error } = await supabase
    .from("purchase_requests")
    .select("*")
    .eq("status", "completed")
    .eq("buyer_id", id)
    .neq("isBuyerDeleted", true); // 삭제된 구매 기록 제외

  if (error) {
    throw new Error(error.message);
  }

  return purchaseHistory;
}

export async function deleteMySaleHistory(requestId: string) {
  const { error } = await supabase
    .from("purchase_requests")
    .update({ isSellerDeleted: true }) // 판매기록 삭제
    .eq("id", requestId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteMyPurchaseHistory(requestId: string) {
  const { error } = await supabase
    .from("purchase_requests")
    .update({ isBuyerDeleted: true }) // 구매기록 삭제
    .eq("id", requestId);

  if (error) {
    throw new Error(error.message);
  }
}
