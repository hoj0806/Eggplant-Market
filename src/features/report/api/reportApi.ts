import { supabase } from '../../../shared/lib/supabaseClient';
import type { ReportReason, ReportTargetType } from '../types';

export type CreateReportInput = {
  targetType: ReportTargetType;
  /** 게시물 번호 또는 사용자 uuid. 어느 쪽인지는 targetType이 말한다. */
  targetId: string;
  reason: ReportReason;
  /** 안 썼으면 빈 문자열. 서버가 눕혀서 null로 저장한다. */
  detail: string;
};

/**
 * 신고 접수.
 *
 * 돌려받는 것이 없다(`create_report`는 returns void). **신고자는 자기 신고도 다시 볼 수 없다** —
 * reports에 select 정책이 아예 없어 설계상 관리자 전용이기 때문이다.
 * 그래서 id를 받아 봐야 두 번 다시 쓸 데가 없고, 애초에 `insert ... returning`이 그 정책에
 * 걸려 실패한다(troble.md 같은 절).
 *
 * 접수됐다는 사실은 오류 없이 끝났다는 것뿐이다. 화면은 그것만 보고 완료 안내를 띄운다.
 */
export async function createReport(input: CreateReportInput): Promise<void> {
  const { error } = await supabase.rpc('create_report', {
    p_target_type: input.targetType,
    p_target_id: input.targetId,
    p_reason: input.reason,
    p_detail: input.detail,
  });

  if (error !== null) {
    throw error;
  }
}
