import { useFetcher } from '@remix-run/react';
import { Button } from './ui/button';
import { Icons } from './icons';
import { useSocket } from '~/hooks/useSocket';

export const CallControls = ({
  conversationId,
  receiverId,
}: {
  conversationId: string;
  receiverId: string;
}) => {
  const fetcher = useFetcher();
  const { socket } = useSocket();

  const handleCall = async (type: 'AUDIO' | 'VIDEO') => {
    try {
      const formData = new FormData();
      formData.append('type', type);
      formData.append('receiverId', receiverId);

      fetcher.submit(formData, {
        method: 'post',
        action: `/conversations/${conversationId}/call`,
      });

      socket?.emit('initiate-call', {
        type,
        receiverId,
        conversationId,
      });
    } catch (error) {
      console.error('Error initiating call:', error);
    }
  };

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="icon"
        onClick={() => handleCall('AUDIO')}
        disabled={fetcher.state !== 'idle'}
      >
        <Icons.phone className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={() => handleCall('VIDEO')}
        disabled={fetcher.state !== 'idle'}
      >
        <Icons.video className="h-4 w-4" />
      </Button>
    </div>
  );
};
