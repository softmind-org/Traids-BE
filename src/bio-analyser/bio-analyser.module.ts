import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { jwtModuleOptions } from '../common/constants/jwt.constants';
import { BioSearch, BioSearchSchema } from './schema/bio-search.schema';
import {
  Subcontractor,
  SubcontractorSchema,
} from '../subcontractor/schema/subcontractor.schema';
import { BioAnalyserController } from './bio-analyser.controller';
import { BioAnalyserService } from './bio-analyser.service';
import { AssistantModule } from '../assistant/assistant.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BioSearch.name, schema: BioSearchSchema },
      { name: Subcontractor.name, schema: SubcontractorSchema },
    ]),
    JwtModule.register(jwtModuleOptions),
    // Reuses the shared Anthropic client provider.
    AssistantModule,
  ],
  controllers: [BioAnalyserController],
  providers: [BioAnalyserService],
})
export class BioAnalyserModule { }
