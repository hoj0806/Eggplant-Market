-- =============================================================================
-- 0023_profile_guard.sql — 프로필 update에서 시스템 칸 잠그기
--
-- **0022를 만들다 발견한 구멍이다.** 알림 설정 칸 셋을 `profiles`에 더하면서 "이 테이블은
-- 사용자가 무엇까지 쓸 수 있나"를 다시 읽었는데, 답이 **전부**였다.
--
--   0001: create policy profiles_update on profiles for update using (auth.uid() = id);
--
-- 내 행이면 어느 칸이든 쓸 수 있다는 뜻이다. `manner_temp`도 포함된다.
--
--   update profiles set manner_temp = 99 where id = auth.uid();   → 통과한다 (확인함)
--
-- 0013이 후기에 들인 공이 이 한 줄로 전부 비켜 간다. 그때 `create_review`를 RPC로 만들고
-- 점수를 화이트리스트로 막고 대상을 서버가 고르게 한 이유가 **매너온도를 스스로 못 올리게**
-- 하려는 것이었는데, 정작 온도 자체는 열려 있었다.
--
-- 0008(messages) · 0015(notifications) · 0020(comments)이 각자 자기 테이블에 둔 것과
-- 같은 자리, 같은 모양의 트리거를 프로필에도 둔다.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 누가 쓰는지로 가른다
--
-- 다른 세 guard와 다른 점이 하나 있다. 저쪽은 "이 칸은 아무도 못 바꾼다"였지만
-- `manner_temp`는 **시스템은 계속 써야 하는 칸**이다(`sync_manner_temp`가 후기가 들고 날
-- 때마다 다시 계산한다). 그래서 칸이 아니라 **경로**를 본다.
--
-- `current_user`가 그 경로를 알려 준다. 클라이언트가 PostgREST로 보내면 `authenticated`
-- (비로그인은 `anon`)이고, `sync_manner_temp`는 `security definer`라 그 안에서는 함수 주인이
-- 된다. 트리거 함수는 invoker라 그 문맥을 그대로 물려받는다 — 확인해 보니 실제로 그렇다.
--
--   ① 사용자가 직접 manner_temp = 99   → 막힌다
--   ② 사용자가 닉네임 수정             → 그대로 된다
--   ③ 후기가 들어와 sync_manner_temp   → 온도가 오른다
--
-- `auth.uid()`로는 가를 수 없다. definer 함수 안에서도 그 값은 그대로 세션의 사용자다 —
-- JWT 클레임을 읽는 GUC이지 실행 권한이 아니기 때문이다.
--
-- `created_at`도 함께 잠근다. 가입 시각이 사후에 바뀌면 "이웃이 된 지 3년" 같은 표시가
-- 거짓이 된다. 지금 그 표시는 없지만, 열어 둘 이유도 없는 칸이다.
--
-- `id`는 적지 않는다. 정책이 `with check` 없이 `using`만 두어 새 행에도 `auth.uid() = id`가
-- 걸리므로 남의 id로 바꾸는 것은 이미 막혀 있다.
-- -----------------------------------------------------------------------------
create or replace function guard_profile_update()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon')
  and (
    new.manner_temp is distinct from old.manner_temp
    or new.created_at is distinct from old.created_at
  ) then
    raise exception '매너온도와 가입 시각은 직접 바꿀 수 없습니다.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

comment on function guard_profile_update is
  '사용자가 보낸 프로필 update에서 manner_temp·created_at 변경을 막는다. 시스템 경로(sync_manner_temp)는 definer라 그대로 통과한다.';

drop trigger if exists profiles_guard_update on profiles;
create trigger profiles_guard_update
  before update on profiles
  for each row execute function guard_profile_update();

-- -----------------------------------------------------------------------------
-- 2. 이 트리거가 손대지 않는 것
--
-- 닉네임 · 사진 · 동네 · 검색 반경 · 알림 설정(0022)은 그대로 열려 있다. 전부 사용자가
-- 자기 뜻으로 정하는 값이고, 남에게 보이더라도 **거짓말이 되지 않는** 값이다.
-- 매너온도가 다른 것은 그것이 **남들이 남긴 근거의 합**이기 때문이다(0016의 `sync_manner_temp`).
--
-- `onboarded_at`도 열어 둔다. 온보딩을 마치며 클라이언트가 직접 찍는 값이라(0002) 잠그면
-- 가입 흐름이 멈춘다. 스스로 앞당겨도 잃는 것은 자기 온보딩뿐이다.
-- -----------------------------------------------------------------------------

comment on table profiles is
  '사용자 프로필. 본인만 수정할 수 있고(0001), 매너온도·가입 시각은 시스템만 쓴다(0023).';
