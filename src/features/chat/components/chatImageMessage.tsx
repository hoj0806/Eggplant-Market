import { useChatImageUrlQuery } from '../hooks/useChatQueries';

type ChatImageMessageProps = {
  /** chat-images 버킷의 저장 경로. 공개 URL이 없어 여기서 서명 URL로 바꾼다. */
  path: string | null;
};

const BOX_CLASS = 'flex h-40 w-40 items-center justify-center rounded-lg bg-gray-100 text-xs dark:bg-gray-800';

function ChatImageMessage(props: ChatImageMessageProps) {
  const urlQuery = useChatImageUrlQuery(props.path);

  if (props.path === null || urlQuery.isError) {
    return <span className={`${BOX_CLASS} text-gray-400`}>사진을 불러오지 못했어요</span>;
  }

  if (urlQuery.data === undefined) {
    return <span className={`${BOX_CLASS} text-gray-400`}>사진을 불러오는 중…</span>;
  }

  return (
    <img
      src={urlQuery.data}
      alt="보낸 사진"
      className="max-h-60 w-40 rounded-lg bg-gray-100 object-cover dark:bg-gray-800"
    />
  );
}

export default ChatImageMessage;
