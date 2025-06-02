import { useFetcher } from '@remix-run/react';
import { useEffect, useRef, useState } from 'react';
import { useUser } from '~/root.tsx';
import type { MessagesType } from '~/routes/conversations_.$conversationId.tsx';
import type { getConversation } from '~/server/chat.server.ts';
import { Button } from './ui/button.tsx';
import { Input } from './ui/input.tsx';
import { useSocket } from '~/hooks/useSocket.tsx';
import { CallControls } from './CallControls.tsx';
import { CallModal } from './CallModal.tsx';
import { IncomingCallModal } from './IncomingCallModal.tsx';
import { Icons } from './icons.tsx';

export const Chatbox = ({
  conversation,
  messages,
  setMessages,
}: {
  conversation: Awaited<ReturnType<typeof getConversation>>;
  messages: MessagesType;
  setMessages: React.Dispatch<React.SetStateAction<MessagesType>>;
}) => {
  const { id: conversationId, users } = conversation;
  const user = useUser();
  const messageFetcher = useFetcher();
  const recipientUser = users.find((u) => u.id !== user.id);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { socket } = useSocket();
  const [currentCall, setCurrentCall] = useState<any>(null);
  const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'ongoing'>('idle');

  // Scroll to bottom on new message
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  // Handle message sending UI
  useEffect(() => {
    if (messageFetcher.state === 'submitting') {
      const message = messageFetcher.formData?.get('content') as string;
      if (!message) return;

      setMessages((prev) => [
        ...prev,
        {
          id: '-1',
          content: message,
          sender: {
            id: user.id,
            firstName: user.firstName,
          },
        },
      ]);

      if (inputRef.current) inputRef.current.value = '';
    }
  }, [messageFetcher, setMessages, user]);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    const handleCallAccepted = (callData) => {
      setCurrentCall(callData);
      setCallStatus('ongoing');
    };

    const handleIncomingCall = (callData) => {
      if (callData.receiverId === user.id) {
        setCurrentCall(callData);
        setCallStatus('idle');
      }
    };

    const handleCallUpdate = (updatedCall) => {
      if (['REJECTED', 'ENDED'].includes(updatedCall.status)) {
        setCurrentCall(null);
        setCallStatus('idle');
      }
    };

    socket.on('call-accepted', handleCallAccepted);
    socket.on('incoming-call', handleIncomingCall);
    socket.on('call-update', handleCallUpdate);

    return () => {
      socket.off('call-accepted', handleCallAccepted);
      socket.off('incoming-call', handleIncomingCall);
      socket.off('call-update', handleCallUpdate);
    };
  }, [socket, user.id]);

  return (
    <>
      {/* Appel en attente */}
      {callStatus === 'calling' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded shadow-lg space-y-2 text-center">
            <p className="text-gray-800 font-medium">En attente de réponse...</p>
            <Button
              onClick={() => {
                socket?.emit('cancel-call', { callId: currentCall?.id });
                setCallStatus('idle');
                setCurrentCall(null);
              }}
            >
              <Icons.phoneOff className="mr-2 h-4 w-4" />
              Annuler
            </Button>
          </div>
        </div>
      )}

      {/* Appel entrant */}
      {currentCall && callStatus === 'idle' && currentCall.receiverId === user.id && (
        <IncomingCallModal
          call={currentCall}
          onAccept={() => {
            socket?.emit('call-accepted', { callId: currentCall.id });
            socket?.emit('join-call', { callId: currentCall.id });
            setCallStatus('ongoing');
          }}
          onReject={() => {
            socket?.emit('reject-call', { callId: currentCall.id });
            setCurrentCall(null);
          }}
        />
      )}

      {/* Appel en cours */}
      {currentCall && callStatus === 'ongoing' && (
        <CallModal
          call={currentCall}
          onClose={() => {
            socket?.emit('end-call', { callId: currentCall.id });
            setCurrentCall(null);
            setCallStatus('idle');
          }}
        />
      )}

      {/* En-tête de discussion */}
      {recipientUser && (
        <div className="flex items-center justify-between bg-white shadow rounded-lg p-4">
          <div className="flex items-center gap-4">
            <img
              src={recipientUser.avatarUrl}
              className="w-12 h-12 rounded-full object-cover"
              alt={recipientUser.firstName}
            />
            <div>
              <h2 className="font-semibold text-gray-800">{recipientUser.firstName}</h2>
              <p className="text-sm text-gray-500">ID : {recipientUser.id}</p>
            </div>
          </div>

          <CallControls conversationId={conversation.id} receiverId={recipientUser.id} />
        </div>
      )}

      {/* Messages */}
      <div
        ref={containerRef}
        className="bg-gray-50 rounded-lg shadow-inner p-4 max-h-[400px] overflow-y-auto space-y-2 my-4"
      >
        {messages.length === 0 ? (
          <div className="text-center text-sm text-gray-400">
            Aucun message. Soyez le premier à écrire !
          </div>
        ) : (
          messages.map((message) => (
            <MessageItem
              key={message.id}
              message={message}
              isSender={message.sender.id === user.id}
            />
          ))
        )}
      </div>

      {/* Zone de saisie */}
      <messageFetcher.Form
        method="POST"
        action={`/conversations/${conversationId}`}
        className="relative flex items-center gap-2"
      >
        <Input
          id="content"
          name="content"
          ref={inputRef}
          placeholder="Envoyer un message"
          type="text"
          className="placeholder:text-xs bg-white flex-1"
          autoCorrect="on"
          required
          autoFocus
        />
        <Button type="submit" size="icon">
          Envoyer
        </Button>
      </messageFetcher.Form>

      {/* Historique des appels */}
      {conversation.calls.length > 0 && (
        <div className="border-t mt-4 pt-4 space-y-2">
          <h3 className="text-sm font-bold text-gray-700">📖 Historique des appels</h3>
          {conversation.calls.map((call) => (
            <div
              key={call.id}
              className="flex items-center justify-between text-sm text-gray-600"
            >
              <div className="flex items-center gap-2">
                <Icons.phone className="h-4 w-4 text-blue-500" />
                <span>
                  {call.type === 'VIDEO' ? 'Appel vidéo' : 'Appel audio'} —{' '}
                  <span className="font-medium">
                    {{
                      ENDED: 'Terminé',
                      MISSED: 'Manqué',
                      REJECTED: 'Rejeté',
                      ONGOING: 'En cours',
                    }[call.status]}
                  </span>
                </span>
              </div>
              <span className="text-xs text-gray-400">
                {new Date(call.createdAt).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

const MessageItem = ({
  message,
  isSender,
}: {
  message: { id: string; content: string; sender: { id: string } };
  isSender: boolean;
}) => (
  <div
    className={`max-w-[70%] px-3 py-2 text-sm rounded-xl shadow-sm ${
      isSender
        ? 'bg-blue-100 text-gray-800 self-end rounded-br-none ml-auto'
        : 'bg-white text-gray-700 self-start rounded-bl-none mr-auto'
    }`}
  >
    {message.content}
  </div>
);
