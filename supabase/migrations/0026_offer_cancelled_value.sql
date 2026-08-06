-- =============================================================================
-- 0026_offer_cancelled_value.sql — offer_status에 'cancelled' 하나만 더한다
--
-- **이 파일이 값 추가 하나뿐인 데는 이유가 있다.** Postgres는 `alter type ... add value`로
-- 더한 enum 값을 **같은 트랜잭션 안에서 쓰지 못한다.**
--
--   ERROR: unsafe use of new value "cancelled" of enum type offer_status
--
-- 실제로 밟아 확인했다. 마이그레이션 파일 하나가 트랜잭션 하나이므로, 값을 더하는 일과
-- 그 값을 쓰는 규칙(0027의 정책·트리거)은 **파일이 갈려야 한다.**
--
-- 값의 뜻은 0027에 적었다. 여기는 그것을 쓸 수 있게 만드는 자리일 뿐이다.
-- =============================================================================

alter type offer_status add value if not exists 'cancelled';
