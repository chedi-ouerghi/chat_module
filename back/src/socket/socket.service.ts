import { Server } from 'socket.io';

export class SocketService {
  public server: Server;

  getCallRoom(callId: string) {
    return `call-${callId}`;
  }

  emitToCall(callId: string, event: string, data: any) {
    this.server.to(this.getCallRoom(callId)).emit(event, data);
  }
}
