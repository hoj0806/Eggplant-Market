-- =============================================================================
-- 0032_post_delete_cleanup.sql — 게시물을 지우면 딸린 것도 함께 간다
--
-- `backlog.md`에 0031이 남긴 부채 둘 중 하나. 0031을 만들다 **실험 뒷정리 중에 재현됐다** —
-- 심어 둔 글을 지웠더니 방과 메시지는 사라졌는데 알림 한 줄이 그대로 남아 있었다.
--
-- -----------------------------------------------------------------------------
-- 게시물을 지우면 무엇이 따라가나
--
-- FK를 세어 보면 여섯이 전부 cascade다.
--
--   chat_rooms · comments · likes · post_images · recently_viewed · reviews
--
-- 후기까지 함께 사라지고, 0016의 `reviews_after_delete`가 상대 매너온도를 다시 계산한다.
-- 여기까지는 이미 맞게 돌아간다.
--
-- **FK가 걸릴 수 없는 것이 둘 남는다.**
--
--   ① 알림      payload가 jsonb라 FK를 걸 자리가 없다
--   ② 채팅 사진  스토리지는 DB 밖이다
--
-- 이 파일은 ①을, 클라이언트(`postApi.deletePost`)가 ②를 맡는다. ②는 여기 정책 한 줄이
-- 열어 줘야 가능하다(아래 2번).
--
-- -----------------------------------------------------------------------------
-- 왜 알림을 지우나 — 0016은 그냥 뒀는데
--
-- 0016은 "이미 보낸 후기 알림도 지우지 않는다"고 적었다. `fetch_notifications`가 left join이라
-- 대상이 없으면 미리보기만 비고 화면은 흘려보낸다는 것이었고, 그건 맞다.
--
-- **다만 그때와 남는 줄의 모양이 다르다.** 0016의 경우는 후기 행만 사라지고 게시물은 살아
-- 있어서, payload의 `post_id`로 제목이 붙고 갈 곳(`/users/{나}`)도 있었다.
--
-- 게시물이 사라지면 조인이 **전부** 빈다.
--
--   이름     없다 (actor는 message·review를 거쳐 나오는데 둘 다 사라졌다)
--   제목     없다 (post가 없다)
--   미리보기 없다
--   갈 곳    없다 (`toPostPath`·`toRoomPath`가 null을 준다 → 누를 수 없는 줄)
--
-- 즉 **"알 수 없는 이웃님이 메시지를 보냈어요" 한 줄만 남는다.** 정보가 0인 줄이고,
-- 눌러도 아무 일이 없다. 0031이 방을 지울 때 알림을 함께 지운 것과 같은 판단이다.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 알림
--
-- 조건이 둘이다. payload의 모양이 타입마다 다르기 때문이다.
--
--   post_id  후기(0016) · 댓글 · 찜(0018)   — payload에 직접 들어 있다
--   room_id  채팅 · 가격 제안(0008)          — 방을 거쳐야 게시물에 닿는다
--
-- **before delete**여야 한다. after면 cascade가 이미 방을 걷어간 뒤라 둘째 조건이 아무것도
-- 못 찾는다. 트리거로 두는 이유는 글을 지우는 길이 하나가 아니어서다 — 판매자가 직접 지우는
-- 길 말고도 **회원탈퇴가 그 사람의 글을 전부 지운다**(posts.seller_id → profiles cascade).
-- RPC에 적으면 그 길이 비껴간다.
--
-- `security definer`인 이유는 0015와 같다. notifications에는 delete 정책이 아예 없고,
-- 0019가 연 것은 "내 알림 한 줄 지우기"뿐이라 남의 알림에는 손댈 수 없다 —
-- 여기서 지우는 것은 **상대에게 간 알림**이다.
--
-- 캐스트가 안전한 이유: payload에 그 키가 없으면 `->>`가 null을 주고 비교가 null이 되어
-- 걸리지 않는다. 이 저장소의 payload는 `actor_id`(uuid)만 빼면 전부 숫자 id다.
-- -----------------------------------------------------------------------------
create or replace function purge_post_notifications()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  delete from notifications n
   where (n.payload ->> 'post_id')::bigint = old.id
      or exists (
        select 1
          from chat_rooms r
         where r.id = (n.payload ->> 'room_id')::bigint
           and r.post_id = old.id
      );

  return old;
end;
$$;

comment on function purge_post_notifications is
  '게시물이 지워질 때 그 글·그 글의 채팅방을 가리키던 알림을 함께 지운다. '
  '남겨 두면 이름도 제목도 갈 곳도 없는 줄이 된다(0032).';

drop trigger if exists posts_before_delete on posts;
create trigger posts_before_delete
  before delete on posts
  for each row execute function purge_post_notifications();

-- -----------------------------------------------------------------------------
-- 2. 채팅 사진 — 방이 사라진 폴더는 누구나 치울 수 있다
--
-- 0031이 `chat_images_delete`에 낸 문은 둘이었다. 올린 사람 본인(0008의 보상 삭제)과
-- **지울 수 있는 방**의 폴더(0031의 뒷정리)다. 게시물 삭제에는 둘 다 안 맞는다.
--
--   본인 것만        판매자가 지우는데 사진은 구매자가 올린 것일 수 있다
--   지울 수 있는 방   게시물이 사라지면 방도 cascade로 사라져 그 판단 자체가 불가능하다
--
-- 그래서 세 번째를 낸다 — **방이 더는 없는 폴더.**
--
-- 넓어 보이지만 실제로 넓지 않다. `chat_images_select`가 방 행을 요구하므로, 방이 없는
-- 폴더의 파일은 **이미 아무도 읽을 수 없다.** 남에게 열어 주는 것이 쓰레기를 치울 권한뿐이라
-- 잃을 것이 없고, 반대로 살아 있는 방에는 이 문이 절대 열리지 않는다.
--
-- 덤이 둘 있다. 0031의 세 걸음이 중간에 끊겨 남은 폴더도, 그전부터 쌓여 있던 옛 고아 파일도
-- 이제 치울 수 있다 — 방 번호를 아는 사람이 지나가면 그때 정리된다.
-- -----------------------------------------------------------------------------
drop policy if exists chat_images_delete on storage.objects;
create policy chat_images_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'chat-images'
    and (
      -- 보상 삭제: 방금 올린 내 파일 (0008)
      (storage.foldername(name))[2] = auth.uid()::text
      -- 방을 지우기 직전의 뒷정리: 양쪽이 다 나간 방의 폴더 (0031)
      or exists (
        select 1
          from chat_rooms r
         where r.id::text = (storage.foldername(name))[1]
           and auth.uid() in (r.buyer_id, r.seller_id)
           and private.is_chat_room_purgeable(r.id)
      )
      -- 방이 이미 사라진 폴더 (0032). 아무도 읽을 수 없는 파일이라 치우는 일만 남았다.
      or not exists (
        select 1
          from chat_rooms r
         where r.id::text = (storage.foldername(name))[1]
      )
    )
  );
