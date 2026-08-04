import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReviewForm from './reviewForm';
import { toMannerTagOptions } from '../utils/reviewRating';

const POSITIVE_TAG = toMannerTagOptions('good')[0];
const NEGATIVE_TAG = toMannerTagOptions('bad')[0];

function renderForm(onSubmit: jest.Mock) {
  render(
    <ReviewForm
      targetNickname="가지이웃"
      isSubmitting={false}
      errorMessage={null}
      onSubmit={onSubmit}
    />,
  );
}

describe('ReviewForm', function reviewFormSuite() {
  it('평가만 고르고 보내도 후기가 된다', async function ratingOnly() {
    const onSubmit = jest.fn();
    renderForm(onSubmit);

    await userEvent.click(screen.getByRole('button', { name: '후기 남기기' }));

    expect(onSubmit).toHaveBeenCalledWith({ rating: 'good', mannerTags: [], comment: '' });
  });

  it('고른 평가·태그·한 줄이 그대로 넘어간다', async function submitsChosenValues() {
    const onSubmit = jest.fn();
    renderForm(onSubmit);

    await userEvent.click(screen.getByRole('button', { name: POSITIVE_TAG }));
    await userEvent.type(screen.getByLabelText('한 줄 후기 (선택)'), '친절했어요');
    await userEvent.click(screen.getByRole('button', { name: '후기 남기기' }));

    expect(onSubmit).toHaveBeenCalledWith({
      rating: 'good',
      mannerTags: [POSITIVE_TAG],
      comment: '친절했어요',
    });
  });

  it('같은 태그를 다시 누르면 빠진다', async function togglesTag() {
    const onSubmit = jest.fn();
    renderForm(onSubmit);

    await userEvent.click(screen.getByRole('button', { name: POSITIVE_TAG }));
    await userEvent.click(screen.getByRole('button', { name: POSITIVE_TAG }));
    await userEvent.click(screen.getByRole('button', { name: '후기 남기기' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ mannerTags: [] }),
    );
  });

  it('평가를 바꾸면 앞서 고른 태그를 버린다', async function resetsTagsOnRatingChange() {
    const onSubmit = jest.fn();
    renderForm(onSubmit);

    await userEvent.click(screen.getByRole('button', { name: POSITIVE_TAG }));
    await userEvent.click(screen.getByRole('button', { name: /별로예요/ }));

    // 좋은 쪽 태그는 화면에서 사라지고 나쁜 쪽 목록으로 갈린다.
    expect(screen.queryByRole('button', { name: POSITIVE_TAG })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: NEGATIVE_TAG })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '후기 남기기' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ rating: 'bad', mannerTags: [] }),
    );
  });

  it('저장에 실패하면 서버가 준 문구를 그대로 보여준다', function showsError() {
    render(
      <ReviewForm
        targetNickname="가지이웃"
        isSubmitting={false}
        errorMessage="이미 후기를 남긴 거래입니다."
        onSubmit={jest.fn()}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('이미 후기를 남긴 거래입니다.');
  });
});
