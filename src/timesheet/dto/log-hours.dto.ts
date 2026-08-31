import { IsString, IsDateString, IsOptional, IsInt, Min, Matches, IsMongoId } from 'class-validator';
import { Type } from 'class-transformer';

export class LogHoursDto {
    @IsMongoId()
    jobId: string;

    @IsDateString()
    date: string; // "2025-11-18"

    @IsString()
    @Matches(/^(0[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/, {
        message: 'checkIn must be in format HH:MM AM/PM',
    })
    checkIn: string; // "08:00 AM"

    @IsString()
    @Matches(/^(0[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/, {
        message: 'checkOut must be in format HH:MM AM/PM',
    })
    checkOut: string; // "05:00 PM"

    /**
     * @deprecated Ignored by the server.
     *
     * weekNumber is now derived from `date` relative to the job's
     * timelineStartDate, so a client value can no longer disagree with the day
     * being logged. Still accepted (and validated) so existing clients that
     * send it are not rejected by the global forbidNonWhitelisted pipe.
     */
    @IsOptional()
    @IsInt()
    @Min(1)
    @Type(() => Number)
    weekNumber?: number;
}
