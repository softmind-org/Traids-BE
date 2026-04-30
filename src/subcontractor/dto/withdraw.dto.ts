import { IsNumber, Min } from 'class-validator';

export class WithdrawDto {
  @IsNumber()
  @Min(1, { message: 'Withdrawal amount must be at least £1' })
  amount: number; // in GBP (e.g. 50.00)
}
