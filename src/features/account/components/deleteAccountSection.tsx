import { useState } from 'react';
import TextField from '../../../shared/ui/textField';
import { useDeleteAccountMutation } from '../hooks/useAccountMutations';
import { toAccountErrorMessage } from '../utils/accountErrorMessage';

const CONFIRM_PHRASE = '탈퇴합니다';

/** 탈퇴하면 사라지는 것들. 되돌릴 수 없다는 말보다 목록이 더 정확하다. */
const LOSS_ITEMS: ReadonlyArray<string> = [
  '올린 게시물과 사진',
  '주고받은 채팅과 대화 내용',
  '받은 후기와 매너온도',
  '찜·최근 본 글·차단 목록',
];

/**
 * 회원탈퇴 — 이 화면에서 가장 위험한 자리라 두 단계로 나눈다.
 *
 * 차단(blockToggleButton)도 한 번 더 묻지만 그쪽은 해제하면 그만이다. 탈퇴는 돌아올 곳이
 * 없어서 "한 번 더 누르기"로는 모자라다고 봤다 — **문구를 직접 적어야** 버튼이 열린다.
 * 무엇이 사라지는지도 그 자리에서 함께 보여 준다. 확인 화면의 목적은 겁을 주는 것이 아니라
 * 지금 무엇을 지우는지 알고 누르게 하는 것이다.
 *
 * 탈퇴에 성공하면 세션이 비고 RequireMember가 로그인 화면으로 보낸다(useAccountMutations).
 * 그래서 여기에는 완료 화면이 없다 — 이 컴포넌트는 그 순간 사라진다.
 */
function DeleteAccountSection() {
  const [isConfirming, setIsConfirming] = useState(false);
  const [phrase, setPhrase] = useState('');
  const deleteAccountMutation = useDeleteAccountMutation();

  const canDelete = phrase.trim() === CONFIRM_PHRASE;

  function startConfirm(): void {
    setPhrase('');
    setIsConfirming(true);
  }

  function cancelConfirm(): void {
    setIsConfirming(false);
    setPhrase('');
  }

  function handleDelete(): void {
    if (!canDelete) {
      return;
    }
    deleteAccountMutation.mutate();
  }

  if (!isConfirming) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
          탈퇴하면 계정과 그동안의 활동이 모두 지워지고 되돌릴 수 없어요.
        </p>
        <button
          type="button"
          onClick={startConfirm}
          className="self-start rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold
                     text-red-600 transition hover:bg-red-50
                     dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
        >
          회원탈퇴
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">
          탈퇴하면 아래가 모두 사라져요.
        </p>
        <ul className="flex flex-col gap-1 pl-4 text-sm text-gray-600 dark:text-gray-300">
          {LOSS_ITEMS.map(function renderLossItem(item: string) {
            return (
              <li key={item} className="list-disc">
                {item}
              </li>
            );
          })}
        </ul>
      </div>

      <TextField
        id="deleteConfirmPhrase"
        label={`확인을 위해 "${CONFIRM_PHRASE}"를 입력해 주세요`}
        value={phrase}
        placeholder={CONFIRM_PHRASE}
        disabled={deleteAccountMutation.isPending}
        onValueChange={setPhrase}
      />

      <div className="flex gap-2">
        <button
          type="button"
          disabled={!canDelete || deleteAccountMutation.isPending}
          onClick={handleDelete}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition
                     hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {deleteAccountMutation.isPending ? '탈퇴하는 중…' : '탈퇴하기'}
        </button>
        <button
          type="button"
          disabled={deleteAccountMutation.isPending}
          onClick={cancelConfirm}
          className="rounded-lg px-4 py-2 text-sm text-gray-600 transition hover:text-gray-800
                     disabled:opacity-60 dark:text-gray-300 dark:hover:text-gray-100"
        >
          취소
        </button>
      </div>

      {deleteAccountMutation.error === null ? null : (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {toAccountErrorMessage(deleteAccountMutation.error)}
        </p>
      )}
    </div>
  );
}

export default DeleteAccountSection;
