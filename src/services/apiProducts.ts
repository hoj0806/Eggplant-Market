import supabase, { supabaseUrl } from "../supabase";

export async function createProductPost(newPost) {
  const images = newPost.image;
  const imagePaths: string[] = [];

  for (const image of images) {
    const imageName = `${Date.now()}-${image.name}`.replace(/\//g, "");
    const { error: uploadError } = await supabase.storage
      .from("product-image")
      .upload(imageName, image);

    if (uploadError) {
      throw new Error(`이미지 업로드 실패: ${uploadError.message}`);
    }

    const publicUrl = `${supabaseUrl}/storage/v1/object/public/product-image/${imageName}`;
    imagePaths.push(publicUrl);
  }

  const { data, error } = await supabase
    .from("products")
    .insert([{ ...newPost, image: imagePaths }])
    .select()
    .maybeSingle();

  if (error) {
    throw new Error("게시물 생성에 실패했습니다!");
  }

  return data;
}
