import { IsEnum, IsString } from 'class-validator';

export enum CallType {
  AUDIO = 'AUDIO',
  VIDEO = 'VIDEO',
}

export class CreateCallDto {
  @IsString()
  receiverId: string;

  @IsEnum(CallType)
  type: CallType;
}
