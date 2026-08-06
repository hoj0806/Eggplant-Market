-- =============================================================================
-- 0027_offer_cancel.sql — 보낸 가격 제안 무르기
--
-- `backlog.md` §5-2. `todo.md`가 4단계 때부터 조건을 달아 둔 항목이다.
--
-- -----------------------------------------------------------------------------
-- 왜 필요한가 — 지금은 잘못 보낸 제안에 갇힌다
--
-- 0008이 `messages_update`를 "발신자가 **아닌** 참여자"로 좁혔다. 상대가 보낸 말풍선의
-- content를 고치지 못하게 하려던 것이고 그 판단은 옳았다. 다만 그 바람에 **자기가 보낸 제안도
-- 건드릴 수 없다.**
--
-- 화면 쪽에는 `hasPendingOfferFrom`이 있다 — 답을 기다리는 제안이 있으면 새 제안을 막는다
-- (대기 중인 제안이 여럿이면 판매자 화면에 수락 버튼이 여러 개 남고, 그중 무엇을 눌러도
-- "합의된 금액"이 되기 때문이다). 둘이 겹치면 이렇게 된다.
--
--   50,000원을 5,000원으로 잘못 보냄 → 무를 길이 없음 + 새로 보낼 수도 없음
--   → 판매자가 답할 때까지 아무것도 못 한다.
--
-- 그래서 여는 것은 **보낸 쪽이 자기 제안을 무르는 길 하나**다.
--
-- -----------------------------------------------------------------------------
-- 정한 것: 답이 끝난 제안은 무르지 않는다
--
-- `pending → cancelled`만 연다. `accepted`·`rejected`는 **상대가 이미 답한 것**이라,
-- 한쪽이 혼자 되돌리면 합의가 깨진다. 말풍선 주석이 처음부터 "되돌리는 길은 없고, 마음이
-- 바뀌면 새로 제안한다"고 적어 둔 그대로다.
--
-- 지우지 않고 상태로 남기는 것도 같은 결이다. 0008이 "대화 기록이 사후에 바뀌면 채팅을
-- 신뢰할 수 없다"고 정한 자리라, 취소는 **없던 일**이 아니라 **취소했다는 기록**이다.
--
-- -----------------------------------------------------------------------------
-- 파 보니 나온 구멍 — 전이를 아무도 막고 있지 않았다
--
-- 이 일을 하려고 0008의 guard를 다시 읽다 알았다. 그 트리거는 "바뀌면 안 되는 칸"만 세고
-- `offer_status`는 **통째로 열어 두었다**(주석도 "offer_status는 열어 둔다"였다).
-- 즉 받는 쪽이 `accepted → rejected`로 뒤집을 수 있었다.
--
-- 화면은 막고 있었다 — `respondToOffer`가 `.eq('offer_status', 'pending')`을 건다.
-- 그래서 **버그로 보이지 않았다.** 클라이언트가 스스로 지키던 규칙이라 요청을 직접 보내면
-- 그만이었다. 0023이 `manner_temp`에서 겪은 것과 같은 모양이다.
--
-- 취소를 열면서 이 자리를 함께 닫는다. 안 닫으면 "수락된 제안은 못 무른다"는 결정이
-- **`cancelled`에만 걸리고 `rejected`로 가는 길은 열린 채**가 된다.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 정책 — "누가"
--
-- 0008이 정책과 트리거로 나눈 구도를 그대로 쓴다. 정책이 "누가", 트리거가 "무엇을"이다.
-- 정책은 어느 칸이 바뀌었는지 볼 수 없으므로 여기서 값까지 재려고 하면 안 된다.
--
-- 발신자에게 여는 문을 **자기 가격 제안 행**으로만 낸다. `type = 'price_offer'`가 그 문이다 —
-- 이 조건이 없으면 발신자가 자기 글·사진 메시지도 update 대상으로 삼을 수 있게 되고,
-- 그때 막는 것은 트리거뿐이 된다. 문을 좁게 내는 편이 낫다.
--
-- 여기에 `'cancelled'`를 적지 않은 것은 취향이 아니다 — 정책 식은 만들 때 곧바로 파싱되므로
-- enum 값을 더한 직후에는 쓸 수 없다(0026 참고). 값을 보는 일은 트리거가 맡는다.
-- -----------------------------------------------------------------------------
drop policy if exists messages_update on messages;
create policy messages_update on messages
  for update
  using (
    exists (
      select 1
        from chat_rooms r
       where r.id = messages.room_id
         and auth.uid() in (r.buyer_id, r.seller_id)
    )
    and (
      -- 받는 쪽: 읽음 표시와 제안 수락·거절 (0008 그대로)
      auth.uid() <> sender_id
      -- 보낸 쪽: 자기 가격 제안 한 종류만
      or type = 'price_offer'
    )
  );

-- -----------------------------------------------------------------------------
-- 2. 트리거 — "무엇을"
--
-- 바뀌면 안 되는 칸 목록은 0008 그대로다. 더한 것은 **전이 규칙**이다.
--
--   · 답이 끝난 제안(accepted·rejected·cancelled)은 더 이상 움직이지 않는다.
--   · 보낸 쪽이 할 수 있는 것은 `cancelled` 하나.
--   · 받은 쪽이 할 수 있는 것은 `accepted`·`rejected`. 남의 제안을 대신 무를 수는 없다.
--   · 읽음 표시는 받는 쪽만 남긴다.
--
-- 마지막 줄은 0008에서는 정책이 대신 지켜 주던 것이다(발신자를 아예 뺐으므로 `read_at`에
-- 손댈 수 없었다). 위에서 발신자에게 문을 열었으니 **그 몫이 여기로 넘어온다** —
-- 안 옮기면 보낸 사람이 자기 메시지를 읽음으로 만들어, 상대는 읽지도 않았는데 "안읽음"이 사라진다.
--
-- `auth.uid()`로 갈라도 되는 이유는 이 테이블을 쓰는 **시스템 경로가 없기 때문**이다.
-- 0023이 `current_user`를 써야 했던 것은 `sync_manner_temp`(definer)가 같은 칸을 쓰기
-- 때문이었는데, messages를 update하는 definer 함수는 하나도 없다(확인함).
-- -----------------------------------------------------------------------------
create or replace function guard_message_update()
returns trigger
language plpgsql
as $$
begin
  if new.room_id      is distinct from old.room_id
  or new.sender_id    is distinct from old.sender_id
  or new.type         is distinct from old.type
  or new.content      is distinct from old.content
  or new.offer_amount is distinct from old.offer_amount
  or new.created_at   is distinct from old.created_at then
    raise exception '메시지는 읽음 표시와 제안 답변만 바꿀 수 있습니다.'
      using errcode = 'check_violation';
  end if;

  if new.offer_status is distinct from old.offer_status then
    -- null에서 오는 것도 여기 걸린다. 글·사진 메시지를 제안인 척 만들 수 없다.
    if old.offer_status is distinct from 'pending' then
      raise exception '이미 답이 끝난 제안은 바꿀 수 없습니다.'
        using errcode = 'check_violation';
    end if;

    if auth.uid() = old.sender_id then
      if new.offer_status is distinct from 'cancelled' then
        raise exception '보낸 제안은 취소만 할 수 있습니다.'
          using errcode = 'check_violation';
      end if;
    elsif new.offer_status not in ('accepted', 'rejected') then
      raise exception '받은 제안은 수락하거나 거절할 수 있습니다.'
        using errcode = 'check_violation';
    end if;
  end if;

  if new.read_at is distinct from old.read_at and auth.uid() = old.sender_id then
    raise exception '읽음 표시는 받는 쪽만 남길 수 있습니다.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

comment on function guard_message_update is
  '메시지 update에서 바꿀 수 있는 것을 좁힌다. 읽음 표시는 받는 쪽만, 제안 상태는 pending에서만 '
  '움직이며 보낸 쪽은 cancelled로, 받은 쪽은 accepted·rejected로만 갈 수 있다(0027).';

-- 트리거 자체는 0008이 붙여 둔 그대로다. 함수만 갈아 끼웠다.

comment on type offer_status is
  '가격 제안의 상태. pending에서만 움직인다 — 보낸 쪽은 cancelled(무르기), 받은 쪽은 accepted·rejected. '
  '답이 끝난 제안은 되돌리지 않는다(0027).';
