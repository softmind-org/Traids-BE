import { IsMongoId } from 'class-validator';

export class SubmitTimesheetDto {
    @IsMongoId()
    timesheetId: string;
}
