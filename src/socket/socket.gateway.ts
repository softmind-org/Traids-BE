import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JWT_SECRET } from '../common/constants/jwt.constants';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Conversation, ConversationDocument } from '../chat/schema/conversation.schema';

@WebSocketGateway({
  cors: {
    origin: '*', // Configure this for production
    credentials: true,
  },
  namespace: '/',
})
export class SocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(SocketGateway.name);

  // Map to store userId -> socketId for direct messaging
  private userSocketMap = new Map<string, string[]>();

  constructor(
    private jwtService: JwtService,
    @InjectModel(Conversation.name) private conversationModel: Model<ConversationDocument>,
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway Initialized');
  }

  async handleConnection(client: Socket) {
    try {
      // Extract token from handshake
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.split(' ')[1];

      if (!token) {
        this.logger.warn(`Client ${client.id} connected without token`);
        // Allow connection but don't associate with user
        return;
      }

      // Verify JWT token
      const payload = this.jwtService.verify(token, {
        secret: JWT_SECRET,
      });

      const userId = payload.sub;
      const userType = payload.userType;

      // Store socket mapping
      client.data.userId = userId;
      client.data.userType = userType;

      // Add socket to user's socket list (user can have multiple connections)
      const existingSockets = this.userSocketMap.get(userId) || [];
      existingSockets.push(client.id);
      this.userSocketMap.set(userId, existingSockets);

      // Join user-specific room for targeted messaging
      client.join(`user:${userId}`);
      client.join(`type:${userType}`); // e.g., type:company or type:subcontractor

      this.logger.log(
        `Client connected: ${client.id} | User: ${userId} | Type: ${userType}`,
      );

      // Send connection success event
      client.emit('connected', {
        message: 'Successfully connected to WebSocket',
        userId,
        userType,
      });
    } catch (error) {
      this.logger.error(`Connection error for ${client.id}: ${error.message}`);
      client.emit('error', { message: 'Authentication failed' });
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;

    if (userId) {
      // Remove socket from user's socket list
      const existingSockets = this.userSocketMap.get(userId) || [];
      const updatedSockets = existingSockets.filter((id) => id !== client.id);

      if (updatedSockets.length > 0) {
        this.userSocketMap.set(userId, updatedSockets);
      } else {
        this.userSocketMap.delete(userId);
      }
    }

    this.logger.log(`Client disconnected: ${client.id} | User: ${userId}`);
  }

  // Get the socket server instance (for use in services)
  getServer(): Server {
    return this.server;
  }

  // Check if user is online
  isUserOnline(userId: string): boolean {
    return this.userSocketMap.has(userId);
  }

  // Get all online users
  getOnlineUsers(): string[] {
    return Array.from(this.userSocketMap.keys());
  }

  // Listen for client joining a room
  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { room: string },
  ) {
    client.join(data.room);
    this.logger.log(`Client ${client.id} joined room: ${data.room}`);
    return { success: true, room: data.room };
  }

  // Listen for client leaving a room
  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { room: string },
  ) {
    client.leave(data.room);
    this.logger.log(`Client ${client.id} left room: ${data.room}`);
    return { success: true, room: data.room };
  }

  // Ping-pong for connection testing
  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    return { event: 'pong', timestamp: new Date().toISOString() };
  }

  // Join a conversation room (with participant validation)
  @SubscribeMessage('joinConversation')
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    try {
      const userId = client.data.userId;
      const userType = client.data.userType;

      if (!userId) {
        return { success: false, error: 'Unauthorized' };
      }

      // Validate conversation ID format
      if (!Types.ObjectId.isValid(data.conversationId)) {
        return { success: false, error: 'Invalid conversation ID' };
      }

      // Find conversation and verify user is a participant
      const conversation = await this.conversationModel.findById(data.conversationId);

      if (!conversation) {
        return { success: false, error: 'Conversation not found' };
      }

      // Check if user is a participant
      const isParticipant =
        (userType === 'company' && conversation.company.toString() === userId) ||
        (userType === 'subcontractor' && conversation.subcontractor.toString() === userId);

      if (!isParticipant) {
        return { success: false, error: 'You are not a participant in this conversation' };
      }

      // Join the conversation room
      const roomName = `conversation:${data.conversationId}`;
      client.join(roomName);

      this.logger.log(
        `User ${userId} (${userType}) joined conversation room: ${roomName}`,
      );

      return { success: true, conversationId: data.conversationId, room: roomName };
    } catch (error) {
      this.logger.error(`Error joining conversation: ${error.message}`);
      return { success: false, error: 'Failed to join conversation' };
    }
  }

  // Leave a conversation room
  @SubscribeMessage('leaveConversation')
  handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const roomName = `conversation:${data.conversationId}`;
    client.leave(roomName);

    this.logger.log(
      `Client ${client.id} left conversation room: ${roomName}`,
    );

    return { success: true, conversationId: data.conversationId };
  }

  // Emit message to conversation room (called by services)
  emitToConversation(conversationId: string, event: string, data: any) {
    const roomName = `conversation:${conversationId}`;
    this.server.to(roomName).emit(event, data);
    this.logger.log(`Emitted ${event} to ${roomName}`);
  }
}
