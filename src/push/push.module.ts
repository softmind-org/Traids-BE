import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { jwtModuleOptions } from '../common/constants/jwt.constants';
import { Company, CompanySchema } from '../company/schema/company.schema';
import {
  Subcontractor,
  SubcontractorSchema,
} from '../subcontractor/schema/subcontractor.schema';
import { firebaseProvider } from './firebase.provider';
import { PushController } from './push.controller';
import { PushService } from './push.service';

/**
 * Global, like SocketModule — push sits beside the socket emit everywhere,
 * so PushService is injectable without importing this module.
 */
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Company.name, schema: CompanySchema },
      { name: Subcontractor.name, schema: SubcontractorSchema },
    ]),
    // JwtAuthGuard on PushController needs JwtService.
    JwtModule.register(jwtModuleOptions),
  ],
  controllers: [PushController],
  providers: [firebaseProvider, PushService],
  exports: [PushService],
})
export class PushModule { }
