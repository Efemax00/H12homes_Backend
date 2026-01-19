// src/terms/dto/submit-terms.dto.ts
import { IsString, IsArray, ValidateNested, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { QuizAnswerDto } from './quiz-answer.dto';

export class SubmitTermsDto {
  @IsUUID()
  propertyId: string;

  @IsString()
  termsVersion: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuizAnswerDto)
  answers: QuizAnswerDto[];
}
