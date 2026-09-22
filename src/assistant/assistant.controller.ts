import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AssistantService } from './assistant.service';
import { SendAssistantMessageDto } from './dto/send-assistant-message.dto';
import { AssistantUserType } from './schema/assistant-conversation.schema';

@Controller('assistant')
@UseGuards(JwtAuthGuard)
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) { }

  /** The assistant serves company and subcontractor users only. */
  private currentUser(req: any): { userId: string; userType: AssistantUserType } {
    const userType = req.user?.userType;
    if (userType !== 'company' && userType !== 'subcontractor') {
      throw new ForbiddenException(
        'The assistant is only available to company and subcontractor accounts',
      );
    }
    return { userId: req.user.sub, userType };
  }

  /**
   * POST /assistant/chat
   * Ask the assistant a question. Omit conversationId to start a new chat.
   */
  @Post('chat')
  @HttpCode(HttpStatus.OK)
  async chat(@Body() dto: SendAssistantMessageDto, @Request() req) {
    const { userId, userType } = this.currentUser(req);
    const result = await this.assistantService.chat(
      userId,
      userType,
      dto.message,
      dto.conversationId,
    );

    return {
      message: 'Reply received',
      data: result,
    };
  }

  /**
   * GET /assistant/conversations
   * The user's chats, newest first (titles only).
   */
  @Get('conversations')
  async listConversations(@Request() req) {
    const { userId, userType } = this.currentUser(req);
    const conversations = await this.assistantService.listConversations(userId, userType);

    return {
      message: 'Conversations retrieved successfully',
      count: conversations.length,
      data: conversations,
    };
  }

  /**
   * GET /assistant/conversations/:id
   * One chat with all its messages.
   */
  @Get('conversations/:id')
  async getConversation(@Param('id') id: string, @Request() req) {
    const { userId, userType } = this.currentUser(req);
    const conversation = await this.assistantService.getConversation(id, userId, userType);

    return {
      message: 'Conversation retrieved successfully',
      data: conversation,
    };
  }
}
