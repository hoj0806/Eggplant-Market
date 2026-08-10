import { supabase } from '../../../shared/lib/supabaseClient';
import { EMPTY_POST_SEARCH_FILTERS } from '../../browse/utils/postSearchFilters';
import { DEFAULT_POST_SORT } from '../../browse/utils/postSort';
// 게시물 삭제가 채팅 사진까지 치운다(0032). 스토리지 경로 규칙은 채팅 기능이 알고 있고,
// 그것을 여기서 다시 적으면 규칙이 두 벌이 된다.
import { fetchPostChatPartners, listChatRoomImagePaths, removeChatImages } from '../../chat/api/chatApi';
import { downscaleImages } from '../../../shared/utils/downscaleImage';
import { POST_IMAGE_BUCKET, toPostImagePaths } from '../utils/postImagePath';
import { validateUploadableImages } from '../utils/validatePostInput';
import type { PostSearchFilters, PostSortOption } from '../../browse/types';
import type { TradePlace } from '../../place/types';
import type { Region, RegionCoords } from '../../region/types';
import type { PostDetail, PostImageItem, PostSeller, PostStatus, PostSummary } from '../types';

// 한 줄 리터럴이어야 한다. 문자열을 +로 이으면 리터럴 타입을 잃어
// supabase-js가 select 결과를 GenericStringError로 추론한다.
// profiles는 seller_id 말고도 likes·recently_viewed를 통해 posts와 이어져 있어서
// 관계를 FK 이름(posts_seller_id_fkey)으로 짚어 줘야 한다. 안 그러면 PGRST201로 거절당한다.
const POST_DETAIL_COLUMNS =
  'id, title, description, price, status, category_id, dong_name, trade_location_text, trade_location_lat, trade_location_lng, view_count, like_count, comment_count, created_at, updated_at, bumped_at, sold_at, seller:profiles!posts_seller_id_fkey (id, nickname, avatar_url, manner_temp), buyer:profiles!posts_buyer_id_fkey (id, nickname, avatar_url), category:categories (id, name), images:post_images (url, sort_order)';

const DEFAULT_IMAGE_EXTENSION = 'jpg';
const SAFE_EXTENSION_PATTERN = /^[a-zA-Z0-9]{1,5}$/;

/** 목록 한 페이지 크기. 홈·검색이 같은 RPC를 쓰므로 값도 하나다. search_posts가 서버에서 50으로 한 번 더 막는다. */
export const POST_SEARCH_PAGE_SIZE = 20;

type PostSummaryRow = {
  id: number;
  title: string;
  price: number;
  status: PostStatus;
  thumbnail_url: string | null;
  dong_name: string | null;
  like_count: number;
  view_count: number;
  comment_count: number;
  bumped_at: string;
  /** 반경 기준으로 부를 때만 채워진다. 다른 목록(마이페이지 등)에는 이 칸 자체가 없다. */
  distance_m?: number | null;
};

type PostDetailRow = {
  id: number;
  title: string;
  description: string;
  price: number;
  status: PostStatus;
  category_id: number | null;
  dong_name: string | null;
  trade_location_text: string | null;
  trade_location_lat: number | null;
  trade_location_lng: number | null;
  view_count: number;
  like_count: number;
  comment_count: number;
  created_at: string;
  updated_at: string;
  bumped_at: string;
  sold_at: string | null;
  seller: {
    id: string;
    nickname: string;
    avatar_url: string | null;
    manner_temp: number | string;
  };
  /** 예약자 또는 구매자. 판매중이면 null. */
  buyer: {
    id: string;
    nickname: string;
    avatar_url: string | null;
  } | null;
  category: { id: number; name: string } | null;
  images: Array<{ url: string; sort_order: number }>;
};

export type CreatePostInput = {
  sellerId: string;
  title: string;
  description: string;
  price: number;
  categoryId: number;
  imageFiles: File[];
  /** 선택 사항. 고르지 않았으면 null. */
  tradePlace: TradePlace | null;
  /** 작성자의 동네. 이 글이 어느 동네 글인지의 기준이다. */
  region: Region;
};

type UploadedImage = {
  path: string;
  url: string;
};

/** POINT의 인자 순서는 (경도, 위도)다. 0003에서 profiles에 쓴 방식과 같다. */
function toPointLiteral(lat: number, lng: number): string {
  return `SRID=4326;POINT(${lng} ${lat})`;
}

function toFileExtension(file: File): string {
  const candidate = file.name.split('.').pop();
  if (candidate !== undefined && SAFE_EXTENSION_PATTERN.test(candidate)) {
    return candidate.toLowerCase();
  }
  return DEFAULT_IMAGE_EXTENSION;
}

function toSeller(row: PostDetailRow['seller']): PostSeller {
  return {
    id: row.id,
    nickname: row.nickname,
    avatarUrl: row.avatar_url,
    // numeric 컬럼은 정밀도 손실을 막으려고 문자열로 오기도 한다.
    mannerTemp: Number(row.manner_temp),
  };
}

/**
 * 거래희망장소는 세 값이 모두 있어야 의미가 있다.
 * 이름만 있고 좌표가 없으면 지도에 찍을 수 없어 없는 것으로 본다.
 */
function toTradePlace(row: PostDetailRow): TradePlace | null {
  if (
    row.trade_location_text === null ||
    row.trade_location_lat === null ||
    row.trade_location_lng === null
  ) {
    return null;
  }

  return {
    // 카카오 장소 id는 저장하지 않는다. 화면 key로만 쓰던 값이라 게시물 id로 대신한다.
    id: String(row.id),
    name: row.trade_location_text,
    addressName: '',
    coords: { lat: row.trade_location_lat, lng: row.trade_location_lng },
  };
}

/** 정렬은 서버에 맡기지 않고 여기서 한다 — 중첩 select의 정렬 옵션은 버전마다 이름이 다르다. */
function toImageUrls(images: PostDetailRow['images']): string[] {
  return [...images]
    .sort(function bySortOrder(left, right): number {
      return left.sort_order - right.sort_order;
    })
    .map(function toUrl(image): string {
      return image.url;
    });
}

function toPostDetail(row: PostDetailRow, isLiked: boolean): PostDetail {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    price: row.price,
    status: row.status,
    categoryId: row.category_id,
    categoryName: row.category?.name ?? null,
    dongName: row.dong_name,
    tradePlace: toTradePlace(row),
    images: toImageUrls(row.images),
    viewCount: row.view_count,
    likeCount: row.like_count,
    commentCount: row.comment_count,
    isLiked,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    bumpedAt: row.bumped_at,
    soldAt: row.sold_at,
    seller: toSeller(row.seller),
    buyer:
      row.buyer === null
        ? null
        : { id: row.buyer.id, nickname: row.buyer.nickname, avatarUrl: row.buyer.avatar_url },
  };
}

function toPostSummary(row: PostSummaryRow): PostSummary {
  return {
    id: row.id,
    title: row.title,
    price: row.price,
    status: row.status,
    thumbnailUrl: row.thumbnail_url,
    dongName: row.dong_name,
    likeCount: row.like_count,
    viewCount: row.view_count,
    commentCount: row.comment_count,
    bumpedAt: row.bumped_at,
    distanceM: row.distance_m ?? null,
  };
}

/**
 * 사진을 스토리지에 올리고 경로·공개 URL을 돌려준다.
 * 경로 첫 칸은 반드시 사용자 id — storage RLS가 본인 폴더만 쓰도록 막고 있다.
 *
 * 순서대로 올린다. 병렬로 올리면 실패했을 때 어디까지 올라갔는지 추적하기 번거롭고,
 * 사진 열 장 남짓이라 체감 차이도 크지 않다.
 */
async function uploadPostImages(sellerId: string, files: File[]): Promise<UploadedImage[]> {
  const uploaded: UploadedImage[] = [];
  const stamp = Date.now();

  // 올리기 전에 줄인다. 폰 사진은 한 장에 3~5MB인데 화면이 쓰는 것은 그 일부다.
  // 여기서 한 번 줄이면 올리는 사람뿐 아니라 **그 뒤로 이 글을 보는 모든 사람**의
  // 데이터가 함께 준다. 실패하면 원본이 그대로 오므로 업로드가 막히지 않는다.
  const prepared = await downscaleImages(files);

  // **줄인 뒤에 다시 잰다.** 고를 때의 상한(12MB)은 원본에 걸리고, 버킷은 5MB에서 막는다.
  // 그 사이가 비어 있으면 GIF처럼 줄일 수 없는 사진이 서버까지 갔다가 거절당한다 —
  // 사용자에게는 이유를 알 수 없는 실패로 보인다. 여기서 먼저, 이유와 함께 세운다.
  const oversized = validateUploadableImages(prepared);
  if (oversized !== undefined) {
    throw new Error(oversized);
  }

  for (const [index, file] of prepared.entries()) {
    const path = `${sellerId}/${stamp}-${index}.${toFileExtension(file)}`;

    const { error } = await supabase.storage
      .from(POST_IMAGE_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: true });

    if (error !== null) {
      await removeUploadedImages(uploaded);
      throw error;
    }

    const { data } = supabase.storage.from(POST_IMAGE_BUCKET).getPublicUrl(path);
    uploaded.push({ path, url: data.publicUrl });
  }

  return uploaded;
}

/** 뒷정리다. 여기서 또 실패해도 원래 오류를 덮지 않도록 조용히 넘어간다. */
async function removeUploadedImages(uploaded: UploadedImage[]): Promise<void> {
  if (uploaded.length === 0) {
    return;
  }

  const paths = uploaded.map(function toPath(image): string {
    return image.path;
  });

  await supabase.storage.from(POST_IMAGE_BUCKET).remove(paths);
}

/** 게시물 본문 한 행. 목록·검색의 기준이 되는 동네 정보를 여기서 함께 박아 넣는다. */
async function insertPostRow(input: CreatePostInput, thumbnailUrl: string): Promise<number> {
  const { data, error } = await supabase
    .from('posts')
    .insert({
      seller_id: input.sellerId,
      title: input.title,
      description: input.description,
      price: input.price,
      category_id: input.categoryId,
      thumbnail_url: thumbnailUrl,
      region_code: input.region.code,
      dong_name: input.region.fullName,
      location: toPointLiteral(input.region.coords.lat, input.region.coords.lng),
      ...(input.tradePlace === null
        ? {}
        : {
            trade_location_text: input.tradePlace.name,
            trade_location: toPointLiteral(
              input.tradePlace.coords.lat,
              input.tradePlace.coords.lng,
            ),
          }),
    })
    .select('id')
    .single();

  if (error !== null) {
    throw error;
  }

  return (data as { id: number }).id;
}

async function insertPostImages(postId: number, uploaded: UploadedImage[]): Promise<void> {
  const rows = uploaded.map(function toRow(image, index) {
    return { post_id: postId, url: image.url, sort_order: index };
  });

  const { error } = await supabase.from('post_images').insert(rows);

  if (error !== null) {
    throw error;
  }
}

/**
 * 게시물 등록. 사진 업로드 → 본문 → 사진 행 순서로 세 번 쓴다.
 *
 * Postgres 트랜잭션으로 묶을 수 없는 구간(스토리지)이 있어 중간에 실패하면 직접 되돌린다.
 * 되돌리지 않으면 아무도 못 보는 사진 파일이나, 사진 없는 게시물이 남는다.
 * 첫 장이 목록 썸네일이다.
 */
export async function createPost(input: CreatePostInput): Promise<number> {
  const uploaded = await uploadPostImages(input.sellerId, input.imageFiles);

  let postId: number;
  try {
    postId = await insertPostRow(input, uploaded[0].url);
  } catch (error) {
    await removeUploadedImages(uploaded);
    throw error;
  }

  try {
    await insertPostImages(postId, uploaded);
  } catch (error) {
    await supabase.from('posts').delete().eq('id', postId);
    await removeUploadedImages(uploaded);
    throw error;
  }

  return postId;
}

export type UpdatePostInput = {
  postId: number;
  sellerId: string;
  title: string;
  description: string;
  price: number;
  categoryId: number;
  /** 화면에 보이는 순서 그대로. 첫 장이 새 썸네일이 된다. */
  images: PostImageItem[];
  tradePlace: TradePlace | null;
};

type PostImageRow = {
  url: string;
  sort_order: number;
};

async function fetchPostImageRows(postId: number): Promise<PostImageRow[]> {
  const { data, error } = await supabase
    .from('post_images')
    .select('url, sort_order')
    .eq('post_id', postId)
    .order('sort_order');

  if (error !== null) {
    throw error;
  }

  return data as PostImageRow[];
}

/**
 * 폼이 들고 있던 순서대로 최종 URL 목록을 만든다.
 *
 * 이미 올라가 있던 사진은 자기 주소를 그대로 쓰고, 새로 고른 사진은 방금 업로드한 결과에서
 * 앞에서부터 하나씩 가져온다 — uploadPostImages가 넘겨받은 파일 순서대로 돌려주기 때문이다.
 */
function toFinalImageUrls(images: PostImageItem[], uploaded: UploadedImage[]): string[] {
  let uploadedIndex = 0;

  return images.map(function toUrl(image: PostImageItem): string {
    if (image.kind === 'existing') {
      return image.url;
    }

    const next = uploaded[uploadedIndex];
    uploadedIndex += 1;
    return next.url;
  });
}

async function updatePostRow(input: UpdatePostInput, thumbnailUrl: string): Promise<void> {
  const { error } = await supabase
    .from('posts')
    .update({
      title: input.title,
      description: input.description,
      price: input.price,
      category_id: input.categoryId,
      thumbnail_url: thumbnailUrl,
      // 동네(region_code·dong_name·location)는 건드리지 않는다.
      // 올린 뒤에 이사를 갔더라도 이 글이 올라온 동네가 바뀌지는 않는다.
      // 장소를 지웠으면 두 컬럼을 함께 비운다. 이름만 남으면 지도에 찍을 수 없다.
      trade_location_text: input.tradePlace?.name ?? null,
      trade_location:
        input.tradePlace === null
          ? null
          : toPointLiteral(input.tradePlace.coords.lat, input.tradePlace.coords.lng),
    })
    .eq('id', input.postId);

  if (error !== null) {
    throw error;
  }
}

async function insertPostImageRows(postId: number, rows: PostImageRow[]): Promise<void> {
  const { error } = await supabase.from('post_images').insert(
    rows.map(function toRow(row: PostImageRow) {
      return { post_id: postId, url: row.url, sort_order: row.sort_order };
    }),
  );

  if (error !== null) {
    throw error;
  }
}

/**
 * 사진 행을 통째로 갈아 끼운다.
 *
 * 순서(sort_order)까지 바뀔 수 있어 행마다 맞춰 고치는 것보다 지우고 다시 넣는 편이 단순하다.
 * 지운 뒤 넣기 전에 실패하면 사진 없는 게시물이 되므로, 그때는 지웠던 행을 도로 넣는다.
 */
async function replacePostImageRows(postId: number, urls: string[]): Promise<void> {
  const previous = await fetchPostImageRows(postId);

  const { error: deleteError } = await supabase.from('post_images').delete().eq('post_id', postId);
  if (deleteError !== null) {
    throw deleteError;
  }

  try {
    await insertPostImageRows(
      postId,
      urls.map(function toRow(url: string, index: number): PostImageRow {
        return { url, sort_order: index };
      }),
    );
  } catch (error) {
    await insertPostImageRows(postId, previous).catch(function ignoreRestoreFailure(): void {
      // 되돌리기까지 실패하면 원래 오류를 덮지 않고 그대로 올린다.
    });
    throw error;
  }
}

/**
 * 게시물 수정.
 *
 * 등록과 같은 문제를 안고 있다 — 스토리지와 테이블을 함께 묶는 트랜잭션이 없다.
 * 그래서 순서를 "되돌리기 쉬운 쪽"으로 잡는다.
 *   ① 새 사진 업로드  (실패해도 아직 아무것도 안 바뀌었다)
 *   ② 본문 갱신       (실패하면 방금 올린 파일을 지운다)
 *   ③ 사진 행 교체     (실패하면 지웠던 행을 되돌리고 방금 올린 파일도 지운다)
 *   ④ 빠진 사진 정리   (여기서 실패해도 수정은 이미 끝났다 — 고아 파일만 남는다)
 *
 * ④를 앞으로 당기지 않는 이유가 이것이다. 먼저 지웠다가 ②·③이 실패하면 화면에는 남아 있는데
 * 파일은 사라진 사진이 생긴다. 되돌릴 수 없는 일은 맨 뒤에 둔다.
 */
export async function updatePost(input: UpdatePostInput): Promise<void> {
  const newFiles: File[] = [];
  for (const image of input.images) {
    if (image.kind === 'new') {
      newFiles.push(image.file);
    }
  }

  const previousUrls = (await fetchPostImageRows(input.postId)).map(function toUrl(
    row: PostImageRow,
  ): string {
    return row.url;
  });

  const uploaded = await uploadPostImages(input.sellerId, newFiles);
  const finalUrls = toFinalImageUrls(input.images, uploaded);

  try {
    await updatePostRow(input, finalUrls[0]);
    await replacePostImageRows(input.postId, finalUrls);
  } catch (error) {
    await removeUploadedImages(uploaded);
    throw error;
  }

  const removedUrls = previousUrls.filter(function isDropped(url: string): boolean {
    return !finalUrls.includes(url);
  });
  await removePostImageFiles(removedUrls);
}

/** 공개 URL로 남아 있는 사진 파일을 스토리지에서 치운다. 뒷정리라 실패해도 넘어간다. */
async function removePostImageFiles(urls: ReadonlyArray<string>): Promise<void> {
  const paths = toPostImagePaths(urls);
  if (paths.length === 0) {
    return;
  }

  await supabase.storage.from(POST_IMAGE_BUCKET).remove(paths);
}

/**
 * 이 글의 채팅방들에 올라온 사진 경로를 모은다.
 *
 * **글을 지우기 전에 불러야 한다.** 방은 cascade로 함께 사라지는데,
 * `chat_images_select`가 방 행을 요구해서 그 뒤에는 목록조차 못 읽는다(0008).
 *
 * 후보는 `fetch_post_chat_partners`(0008)가 준다 — 판매자 본인만 부를 수 있고, 방 번호와
 * 구매자 id가 함께 온다. 폴더가 `{room_id}/{user_id}/…`라 판매자 자신도 넣어야 한다.
 *
 * 뒷정리라 실패해도 던지지 않는다. 여기서 막히면 지울 수 있는 글이 안 지워진다.
 */
async function listPostChatImagePaths(postId: number, sellerId: string): Promise<string[]> {
  try {
    const partners = await fetchPostChatPartners(postId);
    const paths: string[] = [];

    for (const partner of partners) {
      paths.push(...(await listChatRoomImagePaths(partner.roomId, [sellerId, partner.id])));
    }

    return paths;
  } catch {
    return [];
  }
}

/**
 * 게시물 삭제.
 *
 * post_images·likes·recently_viewed·chat_rooms·comments·reviews는 FK가 on delete cascade라
 * 따라 지워지고, 알림은 0032의 트리거가 함께 걷어낸다.
 * **스토리지 파일만은 아무도 지워 주지 않는다.** 그래서 지우기 전에 주소를 먼저 챙긴다.
 *
 * 챙길 것이 둘이다 — 게시물 사진과 **그 글의 채팅방에 오간 사진**이다. 뒤엣것은 0032 전까지
 * 아무도 치우지 않아 비공개 버킷에 영원히 남았다(방이 사라져 읽을 수도 지울 수도 없었다).
 *
 * 행을 먼저 지우고 파일을 나중에 치운다. 반대로 하면 파일 삭제 뒤 행 삭제가 거절당했을 때
 * (RLS·네트워크) 사진이 전부 깨진 게시물이 남는다. 이 순서라면 최악이 고아 파일이다.
 * 채팅 사진은 **그 순서여야만** 지워지기까지 한다 — `chat_images_delete`가 열리는 조건이
 * "방이 이미 사라진 폴더"라서다(0032).
 */
export async function deletePost(postId: number, sellerId: string): Promise<void> {
  const urls = (await fetchPostImageRows(postId)).map(function toUrl(row: PostImageRow): string {
    return row.url;
  });
  const chatImagePaths = await listPostChatImagePaths(postId, sellerId);

  const { error } = await supabase.from('posts').delete().eq('id', postId);
  if (error !== null) {
    throw error;
  }

  await removePostImageFiles(urls);
  await removeChatImages(chatImagePaths);
}

/**
 * 끌어올리기. 갱신된 bumped_at을 돌려준다.
 *
 * 판매자 본인인지, 판매중인지, 24시간이 지났는지는 전부 서버가 본다(0010).
 * 화면의 잠금은 같은 규칙의 사본일 뿐이라 여기서 다시 검사하지 않는다.
 */
export async function bumpPost(postId: number): Promise<string> {
  const { data, error } = await supabase.rpc('bump_post', { p_post_id: postId });

  if (error !== null) {
    throw error;
  }

  return data as string;
}

/** 로그인한 사용자가 이 글을 찜했는지. 비로그인은 요청하지 않는다. */
async function fetchIsLiked(postId: number, viewerId: string | null): Promise<boolean> {
  if (viewerId === null) {
    return false;
  }

  const { data, error } = await supabase
    .from('likes')
    .select('post_id')
    .eq('post_id', postId)
    .eq('user_id', viewerId)
    .maybeSingle();

  if (error !== null) {
    throw error;
  }

  return data !== null;
}

export async function fetchPostDetail(
  postId: number,
  viewerId: string | null,
): Promise<PostDetail> {
  const { data, error } = await supabase
    .from('posts')
    .select(POST_DETAIL_COLUMNS)
    .eq('id', postId)
    .single();

  if (error !== null) {
    throw error;
  }

  const isLiked = await fetchIsLiked(postId, viewerId);

  return toPostDetail(data as unknown as PostDetailRow, isLiked);
}

/**
 * 목록의 다음 페이지를 가리키는 자리.
 *
 * offset이 아니라 마지막으로 읽은 행 자체다. 스크롤하는 동안 누가 글을 올려도
 * 이미 본 글이 다시 나오거나 못 본 글이 밀려 사라지지 않는다.
 *
 * `value`가 문자열인 것은 **정렬 기준마다 커서 컬럼이 달라서**다(0011).
 * 최신순이면 bumped_at, 찜순이면 like_count가 들어온다 — 타입이 제각각이라 하나로 받으려면
 * 문자열이 가장 단순하다. 되돌리는 캐스팅은 정렬 기준을 아는 서버가 한다.
 * 정렬값 하나로는 같은 값을 가진 글을 가를 수 없어 `id`까지 함께 들고 간다.
 */
export type PostSearchCursor = {
  value: string;
  id: number;
};

/**
 * 목록을 무엇으로 모을 것인가. `search_posts`의 기준 인자 넷을 화면 말로 옮긴 것이다(0024).
 *
 * 유니온인 이유는 **두 기준이 서로 다른 값을 요구하기 때문**이다. 필드 넷을 모두 nullable로
 * 늘어놓으면 "코드도 좌표도 없는" 조합과 "둘 다 있는" 조합이 타입상 만들어지는데,
 * 앞은 서버가 거절하고 뒤는 화면이 뜻한 적 없는 교집합이 된다.
 */
export type PostSearchArea =
  | { kind: 'region'; regionCode: string }
  | { kind: 'radius'; coords: RegionCoords; radiusM: number };

export type SearchPostsParams = {
  /** 검색은 언제나 이 범위 안에서만 돈다. 조건이 아니라 전제다. */
  area: PostSearchArea;
  filters: PostSearchFilters;
  sort: PostSortOption;
  /** 첫 페이지는 null. */
  cursor: PostSearchCursor | null;
};

/** 기준을 RPC 인자로 편다. 안 쓰는 쪽은 null이라 서버의 `is null` 분기가 통과시킨다. */
function toAreaParams(area: PostSearchArea) {
  if (area.kind === 'region') {
    return { p_region_code: area.regionCode, p_lat: null, p_lng: null, p_radius_m: null };
  }

  return {
    p_region_code: null,
    p_lat: area.coords.lat,
    p_lng: area.coords.lng,
    p_radius_m: area.radiusM,
  };
}

/**
 * 내 동네 글 목록 한 페이지.
 *
 * 조건을 하나도 걸지 않은 검색과 같은 결과라 search_posts를 그대로 쓴다(0007 참고).
 * 목록을 두 갈래로 두면 6단계의 차단 사용자 제외처럼 "목록이라면 모두 적용돼야 하는 규칙"을
 * 넣을 때마다 두 곳을 고쳐야 한다.
 *
 * 홈은 반경 기준을 열지 않는다. "우리 동네"는 이름으로 아는 자리라 그 범위가 조용히
 * 바뀌면 안 되고, 범위를 고르고 싶은 순간에는 이미 찾는 것이 있으므로 검색이 맡는다 —
 * 정렬 선택을 홈에 두지 않은 것과 같은 이유다.
 */
export async function fetchNeighborhoodPosts(
  regionCode: string,
  cursor: PostSearchCursor | null,
): Promise<PostSummary[]> {
  return searchPosts({
    area: { kind: 'region', regionCode },
    filters: EMPTY_POST_SEARCH_FILTERS,
    sort: DEFAULT_POST_SORT,
    cursor,
  });
}

/**
 * 게시물 검색 + 필터.
 *
 * 조건을 PostgREST 쿼리 빌더로 이어 붙이지 않고 RPC 하나로 보낸다.
 * 제목·본문을 OR로 묶으려면 `.or('title.ilike.%키워드%,...')`처럼 필터를 문자열로 만들어야 하는데,
 * 검색어에 `,`나 `(`가 들어오는 순간 그 문자열의 문법이 깨진다.
 * RPC는 값이 파라미터로 바인딩돼 그런 걱정이 없다. (0007 참고)
 */
export async function searchPosts(params: SearchPostsParams): Promise<PostSummary[]> {
  const { data, error } = await supabase.rpc('search_posts', {
    ...toAreaParams(params.area),
    p_keyword: params.filters.keyword === '' ? null : params.filters.keyword,
    p_category_id: params.filters.categoryId,
    p_min_price: params.filters.minPrice,
    p_max_price: params.filters.maxPrice,
    p_available_only: params.filters.availableOnly,
    p_sort: params.sort,
    p_cursor_value: params.cursor?.value ?? null,
    p_cursor_id: params.cursor?.id ?? null,
    p_limit: POST_SEARCH_PAGE_SIZE,
  });

  if (error !== null) {
    throw error;
  }

  // RPC의 returns table이 목록 카드가 쓰는 컬럼과 같은 모양이라 변환도 그대로 재사용한다.
  return (data as PostSummaryRow[]).map(toPostSummary);
}

export type UpdatePostStatusInput = {
  postId: number;
  status: PostStatus;
  /** 예약자·구매자. 고르지 않았으면 null. 판매중으로 되돌릴 때도 null이다. */
  buyerId: string | null;
};

/**
 * 거래 상태 변경.
 *
 * 서버가 세 가지를 대신 지켜 준다(0008).
 *   · 판매자만 바꿀 수 있다 (posts_update using)
 *   · 거래 상대는 채팅을 건 사람 중에서만 (posts_update with check)
 *   · 거래완료는 되돌릴 수 없고, 판매중으로 오면 예약자가 지워진다 (전이 트리거)
 *
 * 그래서 여기서는 보내기만 한다. sold_at도 트리거가 찍으므로 payload에 넣지 않는다.
 */
export async function updatePostStatus(input: UpdatePostStatusInput): Promise<void> {
  const { error } = await supabase
    .from('posts')
    .update({ status: input.status, buyer_id: input.buyerId })
    .eq('id', input.postId);

  if (error !== null) {
    throw error;
  }
}

/**
 * 조회수 +1.
 * 본인 글 제외는 RPC 안에서 막는다(0005 참고). 여기서는 호출만 한다.
 */
export async function incrementViewCount(postId: number): Promise<void> {
  const { error } = await supabase.rpc('increment_view_count', { p_post_id: postId });

  if (error !== null) {
    throw error;
  }
}

/**
 * 최근 본 글에 남긴다(마이페이지의 "최근 본 글").
 *
 * 누가 봤는지는 보내지 않는다 — RPC가 auth.uid()로 판단한다.
 * 비로그인·본인 글은 서버가 조용히 걸러 내므로(0009) 여기서는 부르기만 한다.
 */
export async function recordRecentlyViewed(postId: number): Promise<void> {
  const { error } = await supabase.rpc('record_recently_viewed', { p_post_id: postId });

  if (error !== null) {
    throw error;
  }
}
