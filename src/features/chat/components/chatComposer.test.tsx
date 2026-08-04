import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatComposer from './chatComposer';

type ComposerOverrides = {
  isSending?: boolean;
  canOfferPrice?: boolean;
  hasPendingOffer?: boolean;
  onSendPriceOffer?: jest.Mock;
};

function renderComposer(
  onSendText: jest.Mock,
  onSendImages: jest.Mock,
  overrides: ComposerOverrides = {},
) {
  render(
    <ChatComposer
      isSending={overrides.isSending ?? false}
      canOfferPrice={overrides.canOfferPrice ?? false}
      postPrice={50000}
      hasPendingOffer={overrides.hasPendingOffer ?? false}
      onSendText={onSendText}
      onSendImages={onSendImages}
      onSendPriceOffer={overrides.onSendPriceOffer ?? jest.fn()}
    />,
  );
}

function toImageFile(name: string, type = 'image/jpeg', size = 1024): File {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

describe('ChatComposer', function chatComposerSuite() {
  it('입력이 비어 있으면 전송 버튼이 잠겨 있다', function emptyInput() {
    renderComposer(jest.fn(), jest.fn());

    expect(screen.getByRole('button', { name: '전송' })).toBeDisabled();
  });

  it('공백만 입력해도 보낼 수 없다', async function whitespaceOnly() {
    renderComposer(jest.fn(), jest.fn());

    await userEvent.type(screen.getByLabelText('메시지 입력'), '   ');

    expect(screen.getByRole('button', { name: '전송' })).toBeDisabled();
  });

  it('메시지를 보내면 앞뒤 공백을 떼고 넘기며 입력을 비운다', async function sendsTrimmed() {
    const onSendText = jest.fn();
    renderComposer(onSendText, jest.fn());

    const input = screen.getByLabelText('메시지 입력');
    await userEvent.type(input, '  아직 있나요?  ');
    await userEvent.click(screen.getByRole('button', { name: '전송' }));

    expect(onSendText).toHaveBeenCalledWith('아직 있나요?');
    expect(input).toHaveValue('');
  });

  it('Enter로도 보낼 수 있다', async function sendsOnEnter() {
    const onSendText = jest.fn();
    renderComposer(onSendText, jest.fn());

    await userEvent.type(screen.getByLabelText('메시지 입력'), '안녕하세요{Enter}');

    expect(onSendText).toHaveBeenCalledWith('안녕하세요');
  });

  it('Shift+Enter는 줄바꿈이라 보내지 않는다', async function newlineOnShiftEnter() {
    const onSendText = jest.fn();
    renderComposer(onSendText, jest.fn());

    await userEvent.type(screen.getByLabelText('메시지 입력'), '한 줄{Shift>}{Enter}{/Shift}두 줄');

    expect(onSendText).not.toHaveBeenCalled();
    expect(screen.getByLabelText('메시지 입력')).toHaveValue('한 줄\n두 줄');
  });

  it('사진을 고르면 그대로 넘긴다', async function sendsImages() {
    const onSendImages = jest.fn();
    renderComposer(jest.fn(), onSendImages);

    const file = toImageFile('photo.jpg');
    await userEvent.upload(screen.getByLabelText('사진 보내기'), file);

    expect(onSendImages).toHaveBeenCalledWith([file]);
  });

  it('용량을 넘는 사진은 보내지 않고 이유를 알려 준다', async function rejectsLargeImage() {
    const onSendImages = jest.fn();
    renderComposer(jest.fn(), onSendImages);

    await userEvent.upload(
      screen.getByLabelText('사진 보내기'),
      toImageFile('big.jpg', 'image/jpeg', 5 * 1024 * 1024 + 1),
    );

    expect(onSendImages).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('사진 한 장의 용량은 5MB 이하여야 합니다.');
  });

  it('보내는 중에는 전송 버튼을 잠근다', async function locksWhileSending() {
    renderComposer(jest.fn(), jest.fn(), { isSending: true });

    await userEvent.type(screen.getByLabelText('메시지 입력'), '안녕');

    expect(screen.getByRole('button', { name: '전송' })).toBeDisabled();
  });

  it('파는 쪽에게는 가격 제안 버튼이 없다', function sellerHasNoOfferButton() {
    renderComposer(jest.fn(), jest.fn(), { canOfferPrice: false });

    expect(screen.queryByRole('button', { name: '가격 제안' })).not.toBeInTheDocument();
  });

  it('가격 제안 버튼을 눌러야 금액 칸이 열린다', async function opensOfferForm() {
    renderComposer(jest.fn(), jest.fn(), { canOfferPrice: true });

    expect(screen.queryByLabelText('얼마에 거래하고 싶으세요?')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '가격 제안' }));

    expect(screen.getByLabelText('얼마에 거래하고 싶으세요?')).toBeInTheDocument();
    expect(screen.getByText('판매가 50,000원')).toBeInTheDocument();
  });

  it('금액을 제안하면 숫자로 넘기고 칸을 닫는다', async function sendsOffer() {
    const onSendPriceOffer = jest.fn();
    renderComposer(jest.fn(), jest.fn(), { canOfferPrice: true, onSendPriceOffer });

    await userEvent.click(screen.getByRole('button', { name: '가격 제안' }));
    await userEvent.type(screen.getByLabelText('얼마에 거래하고 싶으세요?'), '40000');
    await userEvent.click(screen.getByRole('button', { name: '제안' }));

    expect(onSendPriceOffer).toHaveBeenCalledWith(40000);
    expect(screen.queryByLabelText('얼마에 거래하고 싶으세요?')).not.toBeInTheDocument();
  });

  it('숫자가 아닌 금액은 보내지 않고 이유를 알려 준다', async function rejectsNonNumeric() {
    const onSendPriceOffer = jest.fn();
    renderComposer(jest.fn(), jest.fn(), { canOfferPrice: true, onSendPriceOffer });

    await userEvent.click(screen.getByRole('button', { name: '가격 제안' }));
    await userEvent.type(screen.getByLabelText('얼마에 거래하고 싶으세요?'), '4만원');
    await userEvent.click(screen.getByRole('button', { name: '제안' }));

    expect(onSendPriceOffer).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('금액은 숫자만 입력할 수 있습니다.');
  });

  it('답을 기다리는 제안이 있으면 금액 칸 대신 이유가 뜬다', async function blocksSecondOffer() {
    renderComposer(jest.fn(), jest.fn(), { canOfferPrice: true, hasPendingOffer: true });

    await userEvent.click(screen.getByRole('button', { name: '가격 제안' }));

    expect(screen.queryByLabelText('얼마에 거래하고 싶으세요?')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('먼저 보낸 제안의 답을 기다리는 중입니다.');
  });

  it('취소하면 금액 칸이 닫힌다', async function cancelsOffer() {
    renderComposer(jest.fn(), jest.fn(), { canOfferPrice: true });

    await userEvent.click(screen.getByRole('button', { name: '가격 제안' }));
    await userEvent.click(screen.getByRole('button', { name: '취소' }));

    expect(screen.queryByLabelText('얼마에 거래하고 싶으세요?')).not.toBeInTheDocument();
  });
});
