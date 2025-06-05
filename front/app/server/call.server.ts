import { fetcher } from './utils.server.ts';

export const initiateCall = async ({
  request,
  conversationId,
  receiverId,
  type,
}: {
  request: Request;
  conversationId: string;
  receiverId: string;
  type: 'AUDIO' | 'VIDEO';
}) => {
  return await fetcher({
    method: 'POST',
    request,
    url: `/chat/${conversationId}/call`,
    data: {
      receiverId,
      type,
    },
  });
};

export const handleCallAction = async ({
  request,
  callId,
  action,
}: {
  request: Request;
  callId: string;
  action: 'accept' | 'reject' | 'end';
}) => {
  return await fetcher({
    method: 'POST',
    request,
    url: ` https://chat-module-2.onrender.com/chat/calls/${callId}/${action}`,
  });
};
