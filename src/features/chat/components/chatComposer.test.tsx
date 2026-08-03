import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatComposer from './chatComposer';

function renderComposer(onSendText: jest.Mock, onSendImages: jest.Mock, isSending = false) {
  render(
    <ChatComposer isSending={isSending} onSendText={onSendText} onSendImages={onSendImages} />,
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
    renderComposer(jest.fn(), jest.fn(), true);

    await userEvent.type(screen.getByLabelText('메시지 입력'), '안녕');

    expect(screen.getByRole('button', { name: '전송' })).toBeDisabled();
  });
});
