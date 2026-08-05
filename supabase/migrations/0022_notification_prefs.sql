-- =============================================================================
-- 0022_notification_prefs.sql — 알림 종류별 on/off
--
-- `backlog.md` §5-4. §5는 "코드 문제가 아니라 결정 문제"를 모아 둔 절이고, 여기서 정해야 할
-- 것은 하나였다 — **어느 단위로 끌 것인가.**
--
-- 정한 것: **댓글 · 관심(찜) · 거래후기 셋만 끌 수 있다.** 채팅과 가격 제안은 못 끈다.
--
-- 끄면 상대는 답을 기다리는데 나는 모르는 상태가 되고, 그 피해는 **내가 아니라 거래
-- 상대에게** 간다. 알림을 끄는 것은 내 화면을 조용하게 만드는 일이어야지 남을 기다리게
-- 만드는 일이면 안 된다. 나머지 셋은 못 봐도 상대가 손해 보지 않는다.
--
-- 이 판단을 **스키마에 박는다.** 칸을 셋만 만든다 — jsonb 한 칸에 다섯 키를 넣어 두면
-- "chat도 넣을 수 있는데 왜 안 넣지"가 되고, 끌 수 없다는 사실이 코드 어딘가의 if로만 남는다.
-- 칸이 없으면 끌 방법도 없다. 0020에서 제외 목록을 포함 목록으로 뒤집은 것과 같은 결이다.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 끌 수 있는 것만 칸이 있다
--
-- `default true`다. 지금까지 전부 켜진 상태로 써 왔고, 기존 사용자에게는 아무것도 달라지지
-- 않아야 한다. 새로 가입하는 사람도 마찬가지다 — 알림을 켜 두는 것이 이 앱의 기본값이고,
-- 끄는 것이 선택이다.
-- -----------------------------------------------------------------------------
alter table profiles add column if not exists notify_comment boolean not null default true;
alter table profiles add column if not exists notify_like    boolean not null default true;
alter table profiles add column if not exists notify_review   boolean not null default true;

comment on column profiles.notify_comment is
  '댓글·답글 알림을 받을지. 대댓글도 같은 타입이라 하나로 묶인다(0022).';
comment on column profiles.notify_like is
  '내 글을 관심 등록했을 때 알림을 받을지(0022).';
comment on column profiles.notify_review is
  '거래후기 알림을 받을지. 매너온도 계산은 이 값과 무관하게 언제나 돈다(0022).';

-- 채팅·가격 제안에는 칸이 없다. 없는 것이 곧 규칙이다.

-- -----------------------------------------------------------------------------
-- 2. 판정 하나
--
-- `private`에 둔다 — PostgREST가 라우팅하지 않는 스키마라 `supabase.rpc()`로는 닿지 않는다
-- (0014가 `is_blocked`를 여기 둔 이유와 같다). 남의 설정을 물어보는 길을 열 이유가 없다.
--
-- `security definer`인 이유는 두 가지다. 트리거들이 이미 definer이기도 하고,
-- **`profiles_select`가 `using (true)`라 지금은 아무나 읽을 수 있지만**(0001) 그 정책이
-- 언젠가 좁혀져도 이 판정은 계속 돌아야 한다.
--
-- 다섯 타입을 다 받는 이유는 부르는 쪽이 타입을 그대로 넘길 수 있게 하기 위해서다.
-- 칸이 없는 둘은 언제나 true — "끌 수 없다"가 여기 한 줄로 적혀 있다.
--
-- 행이 없으면 true다. 실제로는 일어나지 않는다(부르는 쪽이 이미 그 사람의 존재를 확인했고
-- notifications.user_id가 FK다). 그래도 기본값 쪽으로 기울여 둔다 — 알림이 한 번 더 가는 것이
-- 조용히 사라지는 것보다 낫다.
-- -----------------------------------------------------------------------------
create or replace function private.wants_notification(p_user uuid, p_type notification_type)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select case p_type
               when 'comment' then p.notify_comment
               when 'like'    then p.notify_like
               when 'review'  then p.notify_review
               else true      -- chat · price_offer : 끌 수 없다
             end
        from profiles p
       where p.id = p_user
    ),
    true
  );
$$;

comment on function private.wants_notification(uuid, notification_type) is
  '그 사람이 이 종류의 알림을 받기로 했는가. 채팅·가격 제안은 끌 수 없어 언제나 참이다(0022).';

grant execute on function private.wants_notification(uuid, notification_type)
  to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. 끈 알림은 **아예 만들지 않는다**
--
-- 만들어 두고 목록에서 감추는 방법도 있다. 그렇게 하지 않는다 — 0015가 차단 청소를 만들며
-- 적어 둔 그대로다. **"목록만 걸러 내면 배지 숫자와 어긋난다."** `count_unread_notifications`는
-- 테이블을 세지 목록 RPC를 세지 않으므로, 감추기만 하면 "안 읽은 3"인데 목록에는 한 줄도
-- 없는 상태가 생긴다.
--
-- 받는 사람마다 따로 묻는다. 댓글 알림은 판매자와 부모 댓글 작성자 둘에게 가는데
-- (0018), 한 사람이 껐다고 다른 사람 것까지 막으면 안 된다.
--
-- 껐다가 다시 켜도 그동안의 알림은 오지 않는다. 알림은 "그때 알려 주는 것"이라
-- 0015(차단 해제)·0018(찜 취소)·0021(첫 후기)이 정한 것과 같은 결이다.
-- -----------------------------------------------------------------------------
create or replace function notify_post_liked()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_seller uuid;
begin
  select p.seller_id into v_seller from posts p where p.id = new.post_id;

  if v_seller is null
  or v_seller = new.user_id
  or private.is_blocked(new.user_id, v_seller)
  or not private.wants_notification(v_seller, 'like') then
    return new;
  end if;

  if exists (
    select 1
      from notifications n
     where n.type = 'like'
       and n.payload ->> 'post_id'  = new.post_id::text
       and n.payload ->> 'actor_id' = new.user_id::text
  ) then
    return new;
  end if;

  insert into notifications (user_id, type, payload)
  values (
    v_seller,
    'like',
    jsonb_build_object('post_id', new.post_id, 'actor_id', new.user_id)
  );

  return new;
end;
$$;

comment on function notify_post_liked is
  '찜이 생기면 판매자에게 알린다. 자기 글·차단·알림 끔은 거르고, 같은 사람이 같은 글을 다시 찜해도 한 번만 알린다.';

create or replace function notify_post_commented()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_seller  uuid;
  v_parent  uuid;
  v_payload jsonb;
begin
  select p.seller_id into v_seller from posts p where p.id = new.post_id;

  v_payload := jsonb_build_object(
    'post_id',    new.post_id,
    'comment_id', new.id,
    'actor_id',   new.author_id
  );

  if v_seller is not null
     and v_seller <> new.author_id
     and not private.is_blocked(new.author_id, v_seller)
     and private.wants_notification(v_seller, 'comment') then
    insert into notifications (user_id, type, payload)
    values (v_seller, 'comment', v_payload);
  end if;

  if new.parent_id is not null then
    select c.author_id into v_parent from comments c where c.id = new.parent_id;

    if v_parent is not null
       and v_parent <> new.author_id
       and v_parent is distinct from v_seller
       and not private.is_blocked(new.author_id, v_parent)
       and private.wants_notification(v_parent, 'comment') then
      insert into notifications (user_id, type, payload)
      values (v_parent, 'comment', v_payload);
    end if;
  end if;

  return new;
end;
$$;

comment on function notify_post_commented is
  '댓글이 달리면 판매자에게, 대댓글이면 부모 댓글 작성자에게도 알린다. 본인·중복·차단·알림 끔은 거른다.';

-- -----------------------------------------------------------------------------
-- 4. 후기 — **온도는 끄지 못한다**
--
-- 여기만 모양이 다르다. 이 함수는 두 가지 일을 하는데 그중 하나만 끈다.
--
--   sync_manner_temp  : 언제나 돈다. 매너온도는 알림이 아니라 **받은 후기의 결과**다.
--                       알림을 껐다고 온도가 안 오르면 프로필의 숫자가 후기 목록과 어긋난다.
--   알림 insert       : notify_review가 false면 넣지 않는다.
--
-- 0021의 `is_first` 계산은 알림을 넣을 때만 필요하므로 그 안으로 옮겼다. 알림을 안 보낼
-- 사람에게 "첫 후기인가"를 세어 볼 이유가 없다.
--
-- 알림을 끈 채로 첫 후기를 받으면 축하 줄은 오지 않는다. 나중에 켜도 오지 않는다 —
-- 3번에 적은 대로 알림은 그때 알려 주는 것이다. 온도는 이미 올라 있고 프로필에 보인다.
-- -----------------------------------------------------------------------------
create or replace function recalc_manner_temp()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_is_first boolean;
begin
  perform sync_manner_temp(new.reviewee_id);

  if not private.wants_notification(new.reviewee_id, 'review') then
    return new;
  end if;

  select count(*) = 1 into v_is_first
    from reviews r
   where r.reviewee_id = new.reviewee_id;

  insert into notifications (user_id, type, payload)
  values (
    new.reviewee_id,
    'review',
    jsonb_build_object(
      'post_id',   new.post_id,
      'review_id', new.id,
      'is_first',  v_is_first
    )
  );

  return new;
end;
$$;

comment on function recalc_manner_temp is
  '후기가 들어오면 매너온도를 다시 계산하고(언제나) 알림을 넣는다(설정이 켜져 있을 때만). 첫 후기이면 payload에 is_first를 남긴다.';
