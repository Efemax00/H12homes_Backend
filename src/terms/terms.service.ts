// src/terms/terms.service.ts
import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  PROPERTY_TERMS_CONFIG,
  TermsQuestion,
} from './terms.config';
import { AgreePropertyTermsDto } from './dto/agree-property.dto';




@Injectable()
export class TermsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Return current terms config + whether user has already passed them
   * for a specific property.
   */
  async getCurrentForProperty(userId: string, propertyId?: string) {
    const terms = PROPERTY_TERMS_CONFIG;

    const agreement = await this.prisma.termsAgreement.findFirst({
      where: {
        userId,
        propertyId: propertyId ?? null,
        termsVersion: terms.version,
      },
      orderBy: { agreedAt: 'desc' }, // agreedAt exists on termsAgreement
    });

    let hasAgreed = false;
    let lastScore: number | null = null;

    if (agreement) {
      const quiz = await this.prisma.termsQuizSubmission.findFirst({
        where: {
          agreementId: agreement.id,
          passed: true,
        },
        // ⛔ removed orderBy: { createdAt: 'desc' } because createdAt doesn't exist
      });

      if (quiz) {
        hasAgreed = true;
        lastScore = quiz.score;
      }
    }

    // Instead of terms.text (which doesn't exist), just spread the config
    return {
      ...terms,
      hasAgreed,
      lastScore,
    };
  }

  /**
   * Helper: whether user has already agreed for a given property.
   */
  async hasUserAgreedForProperty(
    userId: string,
    propertyId: string,
  ): Promise<boolean> {
    const terms = PROPERTY_TERMS_CONFIG;

    const agreement = await this.prisma.termsAgreement.findFirst({
      where: {
        userId,
        propertyId,
        termsVersion: terms.version,
      },
      orderBy: { agreedAt: 'desc' },
    });

    if (!agreement) return false;

    const quiz = await this.prisma.termsQuizSubmission.findFirst({
      where: {
        agreementId: agreement.id,
        passed: true,
      },
      // ⛔ removed orderBy here as well
    });

    return !!quiz;
  }

  private scoreAnswers(
    answers: { [key: string]: string },
    questions: TermsQuestion[],
  ): { correctCount: number; totalQuestions: number } {
    const questionsById: Record<string, TermsQuestion> = {};
    for (const q of questions) {
      questionsById[q.id] = q;
    }

    let correctCount = 0;
    const keys = Object.keys(answers);

    for (const questionId of keys) {
      const question = questionsById[questionId];
      if (!question) continue;

      const answer = answers[questionId];
      if (answer && answer === question.correctOption) {
        correctCount += 1;
      }
    }

    const totalQuestions = questions.length || keys.length;

    return { correctCount, totalQuestions };
  }

  /**
   * Handle user submitting quiz + agreeing.
   * DTO shape: { propertyId?, answers: { q1, q2, q3 }, termsVersion }
   */
 async agreeForProperty(userId: string, dto: AgreePropertyTermsDto) {
  const terms = PROPERTY_TERMS_CONFIG;

  // 🔍 Debug log (add this once to see what's happening)
  console.log('dto.termsVersion:', dto.termsVersion, typeof dto.termsVersion);
  console.log('config version:', terms.version, typeof terms.version);

  if (dto.termsVersion !== terms.version) {
    throw new BadRequestException(
      'Invalid terms version, please refresh the page.',
    );
  }

  const { answers } = dto;

    if (
      !answers ||
      typeof answers !== 'object' ||
      !answers.q1 ||
      !answers.q2 ||
      !answers.q3
    ) {
      throw new BadRequestException(
        'All quiz questions must be answered.',
      );
    }

    const { correctCount, totalQuestions } = this.scoreAnswers(
      answers,
      terms.questions,
    );

    if (totalQuestions === 0) {
      throw new BadRequestException('Quiz is not configured.');
    }

    const scorePercent = Math.round(
      (correctCount / totalQuestions) * 100,
    );
    const passed = scorePercent >= terms.passScorePercent;

    if (!passed) {
      throw new ForbiddenException(
        `You must score at least ${terms.passScorePercent}% to continue. Your score: ${scorePercent}%`,
      );
    }

    const agreement = await this.prisma.termsAgreement.create({
      data: {
        userId,
        propertyId: dto.propertyId ?? null,
        termsVersion: terms.version,
        ipAddress: null,
        userAgent: null,
      },
    });

    await this.prisma.termsQuizSubmission.create({
      data: {
        agreementId: agreement.id,
        score: scorePercent,
        passed: true,
        answers: Object.entries(answers).map(
          ([questionId, answer]) => ({
            questionId,
            answer,
          }),
        ),
      },
    });

    return {
      agreementId: agreement.id,
      score: scorePercent,
      passed: true,
    };
  }
}
