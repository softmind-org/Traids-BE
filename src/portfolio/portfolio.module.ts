import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { jwtModuleOptions } from '../common/constants/jwt.constants';
import { PortfolioItem, PortfolioItemSchema } from './schema/portfolio-item.schema';
import {
  Subcontractor,
  SubcontractorSchema,
} from '../subcontractor/schema/subcontractor.schema';
import { PortfolioController } from './portfolio.controller';
import { PortfolioService } from './portfolio.service';
import { CommonModule } from '../common/common.module';
import { RatingModule } from '../rating/rating.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PortfolioItem.name, schema: PortfolioItemSchema },
      { name: Subcontractor.name, schema: SubcontractorSchema },
    ]),
    JwtModule.register(jwtModuleOptions),
    CommonModule,
    RatingModule,
  ],
  controllers: [PortfolioController],
  providers: [PortfolioService],
  exports: [PortfolioService],
})
export class PortfolioModule { }
