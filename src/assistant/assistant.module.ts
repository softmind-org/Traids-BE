import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import Anthropic from '@anthropic-ai/sdk';
import { jwtModuleOptions } from '../common/constants/jwt.constants';
import {
  AssistantConversation,
  AssistantConversationSchema,
} from './schema/assistant-conversation.schema';
import { AssistantController } from './assistant.controller';
import { AssistantService, ASSISTANT_ANTHROPIC_CLIENT } from './assistant.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AssistantConversation.name, schema: AssistantConversationSchema },
    ]),
    JwtModule.register(jwtModuleOptions),
  ],
  controllers: [AssistantController],
  providers: [
    AssistantService,
    {
      provide: ASSISTANT_ANTHROPIC_CLIENT,
      // Without a key the assistant answers 503 instead of stopping the API from booting.
      useFactory: () => (process.env.ANTHROPIC_API_KEY ? new Anthropic() : null),
    },
  ],
  // Shared with BioAnalyserModule so there's one Anthropic client.
  exports: [ASSISTANT_ANTHROPIC_CLIENT],
})
export class AssistantModule { }
