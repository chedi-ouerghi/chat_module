import type { ActionFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { requireUser } from '~/auth.server.ts';
import { initiateCall } from '~/server/call.server.ts';

export const action = async ({ request, params }: ActionFunctionArgs) => {
  await requireUser({ request });
  const conversationId = params.conversationId;
  
  if (!conversationId) {
    return json({ error: true, message: 'Conversation ID manquant' });
  }

  const formData = await request.formData();
  const receiverId = formData.get('receiverId') as string;
  const type = formData.get('type') as 'AUDIO' | 'VIDEO';

  if (!receiverId || !type) {
    return json({ error: true, message: 'Données manquantes' });
  }

  try {
    const result = await initiateCall({
      request,
      conversationId,
      receiverId,
      type,
    });
    return json(result);
  } catch (error) {
    return json({
      error: true,
      message: error instanceof Error ? error.message : 'Une erreur est survenue'
    });
  }
};
