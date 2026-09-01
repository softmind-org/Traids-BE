import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InvoiceController } from './invoice.controller';
import { InvoiceService } from './invoice.service';
import { Invoice, InvoiceSchema } from './schema/invoice.schema';
import { Timesheet, TimesheetSchema } from '../timesheet/schema/timesheet.schema';
import { Job, JobSchema } from '../job/schema/job.schema';
import { Company, CompanySchema } from '../company/schema/company.schema';
import { JwtModule } from '@nestjs/jwt';
import { jwtModuleOptions } from '../common/constants/jwt.constants';
import { StripeModule } from '../stripe/stripe.module';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Invoice.name, schema: InvoiceSchema },
            { name: Timesheet.name, schema: TimesheetSchema },
            { name: Job.name, schema: JobSchema },
            { name: Company.name, schema: CompanySchema },
        ]),
        JwtModule.register(jwtModuleOptions),
        StripeModule,
    ],
    controllers: [InvoiceController],
    providers: [InvoiceService],
    exports: [InvoiceService],
})
export class InvoiceModule { }

