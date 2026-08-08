import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import { createReport } from '../api/reportApi';
import type { ReportReason, ReportTarget } from '../types';

export type CreateReportVariables = {
  reason: ReportReason;
  detail: string;
};

/**
 * 신고 보내기.
 *
 * 성공해도 무효화할 캐시가 없다. 신고는 어떤 화면의 내용도 바꾸지 않는다 —
 * 신고당한 글은 그대로 보이고, 처리 결과는 사람이 나중에 본다.
 * 안 보이게 하고 싶으면 차단이 그 일을 한다(신고 완료 안내가 차단을 권하는 이유다).
 */
export function useCreateReportMutation(
  target: ReportTarget,
): UseMutationResult<void, Error, CreateReportVariables> {
  return useMutation<void, Error, CreateReportVariables>({
    mutationFn: function submit(variables: CreateReportVariables): Promise<void> {
      return createReport({
        targetType: target.type,
        targetId: target.id,
        reason: variables.reason,
        detail: variables.detail,
      });
    },
  });
}
