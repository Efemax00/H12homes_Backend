// src/terms/dto/quiz-answer.dto.ts
import { IsString } from 'class-validator';

export class QuizAnswerDto {
  @IsString()
  questionId: string;

  @IsString()
  answer: string;
}
