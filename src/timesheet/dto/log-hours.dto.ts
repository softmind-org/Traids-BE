import { IsString, IsDateString, Matches, IsMongoId } from 'class-validator';

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
}
