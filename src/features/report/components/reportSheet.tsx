import { useState, type FormEvent, type ReactNode } from 'react';
import SubmitButton from '../../../shared/ui/submitButton';
import TextArea from '../../../shared/ui/textArea';
import { useCreateReportMutation } from '../hooks/useCreateReportMutation';
import { toReportErrorMessage } from '../utils/reportErrorMessage';
import {
  toReportReasonOptions,
  toReportTargetNoun,
  type ReportReasonOption,
} from '../utils/reportReason';
import {
  hasReportFieldError,
  MAX_REPORT_DETAIL_LENGTH,
  validateReportInput,
} from '../utils/validateReportInput';
import type { ReportFieldErrors, ReportReason, ReportTarget } from '../types';

type ReportSheetProps = {
  target: ReportTarget;
  onClose(): void;
  /**
   * 접수 완료 뒤 함께 권하는 행동. 차단 버튼이 온다.
   *
   * 이 자리를 슬롯으로 둔 덕분에 신고는 차단을 **몰라도 된다**. 두 기능이 서로를 가져다 쓰면
   * 어느 쪽도 혼자 시험할 수 없어, 의존 방향을 한쪽(block → report)으로만 냈다.
   */
  completionAction?: ReactNode;
};

const OVERLAY_CLASS =
  'fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6';
const PANEL_CLASS =
  'flex max-h-[90vh] w-full page-narrow flex-col gap-5 overflow-y-auto rounded-t-2xl ' +
  'bg-white p-6 shadow-xl sm:rounded-2xl dark:bg-gray-950';

/**
 * 신고 시트.
 *
 * 사유를 고르고 필요하면 몇 줄 적어 보내는 것이 전부다. 보낸 뒤에는 **되돌아올 화면이 없다** —
 * 신고자는 자기 신고도 다시 조회할 수 없으므로(reports에 select 정책이 없다) "접수됐다"는
 * 안내 한 번이 사용자가 받는 유일한 답이다. 그래서 완료를 폼과 같은 자리에 그리고,
 * 곧바로 닫지 않는다.
 *
 * 완료 화면에서 차단을 권한다. 신고는 사람이 나중에 읽는 일이라 지금 당장 아무것도 바뀌지
 * 않는데, 신고를 누른 사람이 원한 것은 대개 "이 사람을 그만 보고 싶다"이기 때문이다.
 */
function ReportSheet(props: ReportSheetProps) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [detail, setDetail] = useState('');
  const [fieldErrors, setFieldErrors] = useState<ReportFieldErrors>({});
  const [isSubmitted, setIsSubmitted] = useState(false);

  const mutation = useCreateReportMutation(props.target);
  const targetNoun = toReportTargetNoun(props.target.type);
  const reasonOptions = toReportReasonOptions(props.target.type);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    const errors = validateReportInput({ reason, detail }, props.target.type);
    setFieldErrors(errors);

    if (hasReportFieldError(errors) || reason === null) {
      return;
    }

    mutation.mutate(
      { reason, detail },
      {
        onSuccess: function showCompletion(): void {
          setIsSubmitted(true);
        },
      },
    );
  }

  return (
    <div className={OVERLAY_CLASS}>
      <div role="dialog" aria-modal="true" aria-labelledby="report-sheet-title" className={PANEL_CLASS}>
        <header className="flex flex-col gap-1">
          <h2
            id="report-sheet-title"
            className="text-base font-semibold text-gray-900 dark:text-gray-50"
          >
            {targetNoun} 신고
          </h2>
          <p className="truncate text-sm text-gray-500 dark:text-gray-400">{props.target.label}</p>
        </header>

        {isSubmitted ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-50">
                신고가 접수되었어요.
              </p>
              <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                운영팀이 확인한 뒤 조치합니다. 처리 결과는 따로 알려드리지 않고, 접수한 신고는 다시
                볼 수 없어요. 지금 바로 이 {props.target.type === 'post' ? '판매자' : '사용자'}를
                보고 싶지 않다면 차단해 주세요.
              </p>
            </div>

            {props.completionAction}

            <button
              type="button"
              onClick={props.onClose}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium
                         text-gray-700 transition hover:bg-gray-50 dark:border-gray-700
                         dark:text-gray-200 dark:hover:bg-gray-800"
            >
              닫기
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <fieldset className="flex flex-col gap-2">
              <legend className="pb-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                왜 신고하시나요?
              </legend>

              <div className="flex flex-col gap-1">
                {reasonOptions.map(function renderReason(option: ReportReasonOption) {
                  return (
                    <label
                      key={option.value}
                      className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5
                                 text-sm text-gray-800 transition hover:bg-gray-50
                                 dark:text-gray-100 dark:hover:bg-gray-900"
                    >
                      <input
                        type="radio"
                        name="report-reason"
                        value={option.value}
                        checked={reason === option.value}
                        disabled={mutation.isPending}
                        onChange={function selectReason(): void {
                          setReason(option.value);
                        }}
                        className="h-4 w-4 accent-emerald-600"
                      />
                      {option.label}
                    </label>
                  );
                })}
              </div>

              {fieldErrors.reason === undefined ? null : (
                <p role="alert" className="text-xs text-red-600 dark:text-red-400">
                  {fieldErrors.reason}
                </p>
              )}
            </fieldset>

            <TextArea
              id="report-detail"
              label="상세 내용 (선택)"
              value={detail}
              placeholder="무슨 일이 있었는지 적어 주시면 확인에 도움이 됩니다."
              description="적어 주신 내용은 운영팀만 봅니다."
              maxLength={MAX_REPORT_DETAIL_LENGTH}
              rows={4}
              disabled={mutation.isPending}
              errorMessage={fieldErrors.detail}
              onValueChange={setDetail}
            />

            {mutation.error === null ? null : (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                {toReportErrorMessage(mutation.error)}
              </p>
            )}

            <div className="flex flex-col gap-2">
              <SubmitButton
                label="신고하기"
                pendingLabel="보내는 중…"
                isPending={mutation.isPending}
              />
              <button
                type="button"
                disabled={mutation.isPending}
                onClick={props.onClose}
                className="w-full rounded-lg px-4 py-2 text-sm text-gray-600 transition
                           hover:text-gray-800 disabled:opacity-60 dark:text-gray-300
                           dark:hover:text-gray-100"
              >
                취소
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default ReportSheet;
