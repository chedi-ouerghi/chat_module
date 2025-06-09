import { Global, OnModuleInit } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { SocketService } from './socket/socket.service';
import { ChatService } from './chat/chat.service';
import { CallType } from '@prisma/client';
import { CreateCallDto } from './chat/dto/create-call.dto';

@Global()
@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3000', 'https://your-frontend-domain.com'],
    credentials: true,
  },
  namespace: '/',
})
export class AppGateway implements OnGatewayInit, OnModuleInit {
  @WebSocketServer()
  private readonly server: Server;

  constructor(
    private socketService: SocketService,
    private chatService: ChatService,
  ) {}
  afterInit() {
    this.socketService.server = this.server;
  }

  onModuleInit() {
    this.server.emit('confirmation');
  }

  @SubscribeMessage('test')
  async sendMessage(@MessageBody() data, @ConnectedSocket() socket: Socket) {
    console.log(data);
    socket.emit('chat', "Salut j'ai bien reçu ton message");
  }

  @SubscribeMessage('join-chat-room')
  async joinChatRoom(
    @MessageBody() conversationId: string,
    @ConnectedSocket() socket: Socket,
  ) {
    console.log({ conversationId });
    socket.join(conversationId);
  }

  @SubscribeMessage('connection')
  async sendConfirm(@ConnectedSocket() socket: Socket) {
    socket.emit('confirmation');
  }

  @SubscribeMessage('join-call')
  async joinCall(
    @MessageBody() data: { callId: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const { callId } = data;
    const call = await this.chatService.handleCallAction({
      callId,
      action: 'accept',
      userId: socket.data.userId,
    });

    socket.join(`call-${callId}`);
    this.server.to(`call-${callId}`).emit('call-update', call);
  }

  @SubscribeMessage('reject-call')
  async rejectCall(
    @MessageBody() data: { callId: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const { callId } = data;
    const call = await this.chatService.handleCallAction({
      callId,
      action: 'reject',
      userId: socket.data.userId,
    });

    this.server.to(`call-${callId}`).emit('call-update', call);
  }

  @SubscribeMessage('end-call')
  async endCall(
    @MessageBody() data: { callId: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const { callId } = data;
    const call = await this.chatService.handleCallAction({
      callId,
      action: 'end',
      userId: socket.data.userId,
    });

    this.server.to(`call-${callId}`).emit('call-update', call);
    // Déconnecter tous les utilisateurs de la room d'appel
    this.server.in(`call-${callId}`).socketsLeave(`call-${callId}`);
  }

  @SubscribeMessage('initiate-call')
  async handleInitiateCall(
    @MessageBody()
    data: {
      type: CallType;
      receiverId: string;
      conversationId: string;
    },
    @ConnectedSocket() socket: Socket,
  ) {
    const { type, receiverId, conversationId } = data;
    const call = await this.chatService.initiateCall({
      createCallDto: { type, receiverId } as CreateCallDto,
      conversationId,
      callerId: socket.data.userId,
    });

    setTimeout(async () => {
      const currentCall = await this.chatService.getCall(call.callId);
      if (currentCall?.status === 'PENDING') {
        await this.chatService.handleCallAction({
          callId: call.callId,
          action: 'miss',
          userId: socket.data.userId,
        });
      }
    }, 10000);

    return call;
  }

  @SubscribeMessage('webrtc-signal')
  async handleWebRTCSignal(
    @MessageBody()
    data: {
      type: string;
      sdp?: RTCSessionDescription;
      candidate?: RTCIceCandidate;
      callId: string;
      targetUserId: string;
    },
    @ConnectedSocket() socket: Socket,
  ) {
    console.log('Signal WebRTC reçu:', data.type);

    try {
      const call = await this.chatService.getCall(data.callId);
      if (!call || call.status !== 'ONGOING') {
        console.log('Appel non actif ou inexistant');
        return;
      }

      // Émettre le signal au destinataire
      this.server.to(`user_${data.targetUserId}`).emit('webrtc-signal', {
        type: data.type,
        sdp: data.sdp,
        candidate: data.candidate,
        callId: data.callId,
        callerId: socket.data.userId,
      });

      console.log(
        `Signal ${data.type} transmis à l'utilisateur ${data.targetUserId}`,
      );
    } catch (error) {
      console.error('Erreur traitement signal WebRTC:', error);
      socket.emit('webrtc-error', {
        message: 'Erreur lors de la transmission du signal',
        error: error.message,
      });
    }
  }
}
