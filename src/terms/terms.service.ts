// src/terms/terms.service.ts
import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  PROPERTY_TERMS_CONFIG,
  CURRENT_PROPERTY_TERMS_VERSION,
  TermsQuestion,
} from './terms.config';
import { SubmitTermsDto } from './dto/submit-terms.dto';

@Injectable()
export class TermsService {
  constructor(private readonly prisma: PrismaService) {}

  getCurrentPropertyTerms() {
    return PROPERTY_TERMS_CONFIG;
  }

  async hasUserAgreedForProperty(userId: string, propertyId: string): Promise<boolean> {
    const agreement = await this.prisma.termsAgreement.findFirst({
      where: {
        userId,
        propertyId,
        termsVersion: CURRENT_PROPERTY_TERMS_VERSION,
      },
      orderBy: { agreedAt: 'desc' },
    });

    if (!agreement) return false;

    const quiz = await this.prisma.termsQuizSubmission.findFirst({
      where: {
        agreementId: agreement.id,
        passed: true,
      },
    });

    return !!quiz;
  }

  async submitPropertyTerms(userId: string, dto: SubmitTermsDto) {
    const terms = PROPERTY_TERMS_CONFIG;

    if (dto.termsVersion !== terms.version) {
      throw new BadRequestException('Invalid terms version, please refresh the page.');
    }

    if (!dto.answers || dto.answers.length === 0) {
      throw new BadRequestException('Quiz answers are required.');
    }

    // map by questionId for scoring
    const questionsById: Record<string, TermsQuestion> = {};
    for (const q of terms.questions) {
      questionsById[q.id] = q;
    }

    let correctCount = 0;

    for (const answer of dto.answers) {
      const question = questionsById[answer.questionId];
      if (!question) {
        continue;
      }
      if (answer.answer === question.correctOption) {
        correctCount += 1;
      }
    }

    const totalQuestions = terms.questions.length;
    if (totalQuestions === 0) {
      throw new BadRequestException('Quiz is not configured.');
    }

    const scorePercent = Math.round((correctCount / totalQuestions) * 100);
    const passed = scorePercent >= terms.passScorePercent;

    if (!passed) {
      throw new ForbiddenException(
        `You must score at least ${terms.passScorePercent}% to continue. Your score: ${scorePercent}%`,
      );
    }

    // Create agreement record
    const agreement = await this.prisma.termsAgreement.create({
      data: {
        userId,
        propertyId: dto.propertyId,
        termsVersion: terms.version,
        ipAddress: null,
        userAgent: null,
      },
    });

    // Save quiz submission
    await this.prisma.termsQuizSubmission.create({
      data: {
        agreementId: agreement.id,
        score: scorePercent,
        passed: true,
        answers: dto.answers.map((a) => ({
          questionId: a.questionId,
          answer: a.answer,
        })),
      },
    });

    return {
      agreementId: agreement.id,
      score: scorePercent,
      passed: true,
    };
  }
}
