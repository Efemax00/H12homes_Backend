// src/terms/terms.config.ts

export const CURRENT_PROPERTY_TERMS_VERSION = 'PROPERTY_TERMS_V1';

export interface TermsQuestion {
  id: string;
  question: string;
  options: string[];
  correctOption: string; // store the actual option text
}

export interface PropertyTermsConfig {
  version: string;
  title: string;
  content: string; // long terms text
  questions: TermsQuestion[];
  passScorePercent: number;
}

export const PROPERTY_TERMS_CONFIG: PropertyTermsConfig = {
  version: CURRENT_PROPERTY_TERMS_VERSION,
  title: 'H12homes Rental Safety & Payment Terms',
  content: `
By continuing, you agree to the following key rules:

1. All rent and fees must be paid ONLY to H12homes company account, never directly to any agent.
2. You must never pay cash to an agent or landlord without a traceable receipt.
3. H12homes will only recognize transactions that follow the official payment flow and upload of proof.
4. Any agent who asks you to pay outside the official flow should be reported immediately.
5. You understand that H12homes will only release funds to the landlord after confirming your proof and verification.
6. You agree to read the listing details carefully and ask questions in chat before payment.

(This is just placeholder text — replace with your real legal terms later.)
  `.trim(),
  questions: [
    {
      id: 'q1',
      question:
        'Where should all official rent and fees be paid for properties on H12homes?',
      options: [
        'Directly to the agent personal account',
        'Cash to landlord on first visit',
        'Only to official H12homes company account',
        'Any account the agent provides',
      ],
      correctOption: 'Only to official H12homes company account',
    },
    {
      id: 'q2',
      question:
        'What should you do if an agent tells you to pay outside the official H12homes process?',
      options: [
        'Ignore and pay to keep the house quickly',
        'Report the agent to H12homes immediately',
        'Negotiate a lower price and pay',
        'Nothing, it is normal',
      ],
      correctOption: 'Report the agent to H12homes immediately',
    },
    {
      id: 'q3',
      question:
        'When will H12homes release money to the landlord for rent?',
      options: [
        'Immediately the agent requests it',
        'After H12homes confirms your payment proof and landlord details',
        'After any bank transfer screenshot is sent',
        'At the end of the year',
      ],
      correctOption:
        'After H12homes confirms your payment proof and landlord details',
    },
  ],
  passScorePercent: 80,
};
