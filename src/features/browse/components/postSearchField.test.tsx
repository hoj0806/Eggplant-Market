import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PostSearchField from './postSearchField';

const DEBOUNCE_MS = 400;

function advance(ms: number): void {
  act(function runTimers() {
    jest.advanceTimersByTime(ms);
  });
}

describe('PostSearchField', function postSearchFieldSuite() {
  beforeEach(function useFakeTimers() {
    jest.useFakeTimers();
  });

  afterEach(function restoreTimers() {
    jest.useRealTimers();
  });

  it('타이핑이 잠잠해질 때까지 기다렸다가 한 번만 알린다', async function debounceCase() {
    const handleChange = jest.fn();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    render(<PostSearchField keyword="" onKeywordChange={handleChange} />);

    await user.type(screen.getByLabelText('물건 검색'), '노트북');
    expect(handleChange).not.toHaveBeenCalled();

    advance(DEBOUNCE_MS);

    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange).toHaveBeenCalledWith('노트북');
  });

  it('Enter를 누르면 기다리지 않고 바로 검색한다', async function submitCase() {
    const handleChange = jest.fn();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    render(<PostSearchField keyword="" onKeywordChange={handleChange} />);

    await user.type(screen.getByLabelText('물건 검색'), '의자{Enter}');

    expect(handleChange).toHaveBeenCalledWith('의자');
  });

  it('앞뒤 공백만 지운 값을 넘긴다', async function trimCase() {
    const handleChange = jest.fn();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    render(<PostSearchField keyword="" onKeywordChange={handleChange} />);

    await user.type(screen.getByLabelText('물건 검색'), '  의자  ');
    advance(DEBOUNCE_MS);

    expect(handleChange).toHaveBeenCalledWith('의자');
  });

  it('뒤로가기로 URL 검색어가 바뀌면 입력창도 따라오고, 옛 값을 되돌려 보내지 않는다', function syncCase() {
    const handleChange = jest.fn();

    const { rerender } = render(<PostSearchField keyword="노트북" onKeywordChange={handleChange} />);
    expect(screen.getByLabelText('물건 검색')).toHaveValue('노트북');

    rerender(<PostSearchField keyword="" onKeywordChange={handleChange} />);
    advance(DEBOUNCE_MS);

    expect(screen.getByLabelText('물건 검색')).toHaveValue('');
    expect(handleChange).not.toHaveBeenCalled();
  });
});
