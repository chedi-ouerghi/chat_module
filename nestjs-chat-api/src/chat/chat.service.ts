import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { SocketService } from 'src/socket/socket.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendChatDto } from './dto/send-chat.dto';
import { CreateCallDto } from './dto/create-call.dto';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly socketService: SocketService,
  ) {}

  async createConversation({
    createConversationDto: { recipientId },
    userId,
  }: {
    createConversationDto: CreateConversationDto;
    userId: string;
  }) {
    try {
      const [existingRecipient, existingUser] = await Promise.all([
        this.prisma.user.findUnique({
          where: {
            id: recipientId,
          },
        }),
        this.prisma.user.findUnique({
          where: {
            id: userId,
          },
        }),
      ]);
      if (!existingRecipient) {
        throw new Error("L'utilisateur sélectionné n'existe pas.");
      }

      if (!existingUser) {
        throw new Error("L'utilisateur n'existe pas.");
      }
      const createdConversation = await this.prisma.conversation.create({
        data: {
          users: {
            connect: [
              {
                id: existingUser.id,
              },
              {
                id: existingRecipient.id,
              },
            ],
          },
        },
      });

      return {
        error: false,
        conversationId: createdConversation.id,
        message: 'La conversation a bien été créée.',
      };
    } catch (error) {
      console.error(error);
      return {
        error: true,
        message: error.message,
      };
    }
  }

  async sendChat({
    sendChatDto,
    conversationId,
    senderId,
  }: {
    sendChatDto: SendChatDto;
    conversationId: string;
    senderId: string;
  }) {
    try {
      const [existingConversation, existingUser] = await Promise.all([
        this.prisma.conversation.findUnique({
          where: {
            id: conversationId,
          },
        }),
        this.prisma.user.findUnique({
          where: {
            id: senderId,
          },
        }),
      ]);
      if (!existingConversation) {
        throw new Error("La conversation n'existe pas.");
      }

      if (!existingUser) {
        throw new Error("L'utilisateur n'existe pas.");
      }
      const updatedConversation = await this.prisma.conversation.update({
        where: {
          id: existingConversation.id,
        },
        data: {
          messages: {
            create: {
              content: sendChatDto.content,
              sender: {
                connect: {
                  id: existingUser.id,
                },
              },
            },
          },
        },
        select: {
          id: true,
          messages: {
            select: {
              content: true,
              id: true,
              sender: {
                select: {
                  id: true,
                  firstName: true,
                },
              },
            },
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
      });
      // Envoi d'une notification à l'utilisateur ayant reçu le message
      this.socketService.server
        .to(updatedConversation.id)
        .emit('send-chat-update', updatedConversation.messages);
      console.log(updatedConversation);

      return {
        error: false,
        message: 'Votre message a bien été envoyé.',
      };
    } catch (error) {
      console.error(error);
      return {
        error: true,
        message: error.message,
      };
    }
  }

  async getConversations({ userId }: { userId: string }) {
    const existingUser = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        conversations: {
          select: {
            id: true,
            updatedAt: true,
            users: {
              select: {
                id: true,
                firstName: true,
              },
            },
            messages: {
              select: {
                content: true,
                id: true,
                sender: {
                  select: {
                    id: true,
                    firstName: true,
                  },
                },
              },
              orderBy: {
                createdAt: 'desc',
              },
              take: 1,
            },
          },
          orderBy: {
            updatedAt: 'desc',
          },
        },
      },
    });
    if (!existingUser) {
      throw new Error("L'utilisateur n'existe pas.");
    }
    return existingUser.conversations;
  }

  async getConversation({
    userId,
    conversationId,
  }: {
    userId: string;
    conversationId: string;
  }) {
    const existingUser = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });
    if (!existingUser) {
      throw new Error("L'utilisateur n'existe pas.");
    }

    const conversation = await this.prisma.conversation.findUnique({
      where: {
        id: conversationId,
      },
      select: {
        id: true,
        updatedAt: true,
        users: {
          select: {
            firstName: true,
            id: true,
            receivedDonations: {
              select: {
                amount: true,
                id: true,
                createdAt: true,
              },
              where: {
                givingUserId: existingUser.id,
              },
            },
            givenDonations: {
              select: {
                amount: true,
                id: true,
                createdAt: true,
              },
              where: {
                receivingUserId: existingUser.id,
              },
            },
          },
        },
        messages: {
          select: {
            content: true,
            id: true,
            sender: {
              select: {
                id: true,
                firstName: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
        calls: {
          select: {
            id: true,
            type: true,
            status: true,
            createdAt: true,
            endedAt: true,
            callerId: true,
            receiverId: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });
    if (!conversation) {
      throw new Error("Cette conversation n'existe pas.");
    }

    return conversation;
  }

  async initiateCall({
    createCallDto,
    conversationId,
    callerId,
  }: {
    createCallDto: CreateCallDto;
    conversationId: string;
    callerId: string;
  }) {
    try {
      const call = await this.prisma.chatCall.create({
        data: {
          type: createCallDto.type,
          conversation: {
            connect: { id: conversationId },
          },
          caller: {
            connect: { id: callerId },
          },
          receiver: {
            connect: { id: createCallDto.receiverId },
          },
        },
        include: {
          caller: {
            select: {
              id: true,
              firstName: true,
            },
          },
        },
      });

      // Émettre l'événement d'appel entrant via socket
      this.socketService.server.to(conversationId).emit('incoming-call', call);

      return {
        error: false,
        callId: call.id,
        message: 'Appel initié',
      };
    } catch (error) {
      return {
        error: true,
        message: error.message,
      };
    }
  }

  async handleCallAction({
    callId,
    action,
    userId,
  }: {
    callId: string;
    action: 'accept' | 'reject' | 'end' | 'miss';
    userId: string;
  }) {
    try {
      const call = await this.prisma.chatCall.findUniqueOrThrow({
        where: { id: callId },
        include: { conversation: true, caller: true, receiver: true },
      });

      const status =
        action === 'accept'
          ? 'ONGOING'
          : action === 'reject'
          ? 'REJECTED'
          : action === 'miss'
          ? 'MISSED'
          : 'ENDED';

      const updatedCall = await this.prisma.chatCall.update({
        where: { id: callId },
        data: {
          status,
          ...(status === 'ENDED' || status === 'REJECTED' || status === 'MISSED'
            ? { endedAt: new Date() }
            : {}),
        },
        include: {
          caller: true,
          receiver: true,
        },
      });

      // Émettre l'événement approprié
      if (status === 'ONGOING') {
        this.socketService.server
          .to(call.conversation.id)
          .emit('call-accepted', updatedCall);
      } else {
        this.socketService.server
          .to(call.conversation.id)
          .emit('call-update', updatedCall);
      }

      return updatedCall;
    } catch (error) {
      console.error('Call action error:', error);
      throw error;
    }
  }

  async getCall(callId: string) {
    try {
      const call = await this.prisma.chatCall.findUniqueOrThrow({
        where: { id: callId },
      });
      return call;
    } catch (error) {
      return null;
    }
  }
}
