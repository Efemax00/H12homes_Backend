import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
import { PrismaService } from '../../prisma/prisma.service';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const AI_USER_ID = '00000000-0000-0000-0000-000000000001';

@Injectable()
export class ChatService {
  private groq: Groq;
  

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService) {
    const apiKey = this.configService.get<string>('GROQ_API_KEY');
    this.groq = new Groq({ apiKey });
  }

  /**
   * General chat - for random questions (your current implementation)
   * UNCHANGED - keeps original personality and responses
   */
  async sendMessage(messages: Array<{ role: string; content: string }>) {
    const systemPrompt = {
      role: 'system' as const,
      content: `You are a helpful real estate assistant for H12homes, a property platform in Nigeria. 

COMPANY BACKGROUND:
- Founded: 2025 in Delta State
- Mission: Revolutionize Nigerian housing by providing quick access to rental homes and offering trustworthy property buying/reselling at fair prices
- Vision: Become the face of housing in Nigeria
- Slogan: "Where Comfort Meets Trust"
- Founder: Efe David Oderhohwo and team, inspired by personal struggles with Nigeria's broken agent system

THE PROBLEM WE SOLVE:
H12homes was born from frustration with Nigeria's broken agent system:
- Unreliable individual agents who ghost clients
- Hidden fees and unfair pricing
- Endless delays (months of searching)
- No professionalism or accountability

OUR SOLUTION:
- Corporate structure with organized departments (not individual agents)
- 100% transparent pricing - no hidden fees
- Fast results (weeks, not months)
- Verified listings with real photos
- 24/7 customer support
- Professional service with accountability

CORE VALUES:
1. Trust - Honesty and transparency in every transaction
2. Efficiency - Fast, professional service
3. Fairness - Win-win for buyers and sellers
4. Professionalism - Corporate company with organized teams
5. Innovation - Modern technology and systems
6. Reliability - Consistent, dependable service

LOCATIONS:
- Currently operating: Delta State (Warri, Ughelli, Asaba, Agbarho, Ogwashi-Uku)
- Expanding to: Lagos, Abuja, Port Harcourt, and other major cities

SERVICES:
- Rental homes (quick access)
- Property buying and reselling
- Houses, apartments, hotels, household items
- Property management

TEAM STRUCTURE:
- Property Acquisition team
- Sales & Marketing team
- Rental Services team
- Quality Inspection team
- Customer Support (24/7)
- Legal & Documentation team

KEY STATS:
- 100+ happy clients
- 5+ cities served
- 0 hidden fees
- 100% verified listings
- First 120 properties facilitated

HOW WE'RE DIFFERENT:
Unlike traditional agents, we offer:
- Corporate accountability vs individual operators
- Transparent pricing vs hidden fees
- Reliable communication vs ghosting
- Verified listings vs fake photos
- Structured processes vs informal operations
- Fast results vs months of waiting

USER REQUIREMENTS:
- Users must login to contact sellers
- Contact is via WhatsApp (no payment integration yet)
- We advocate for buyers' rights

YOUR ROLE:
- Help users find properties
- Answer questions about buying, renting, listings
- Explain our company values and how we're different
- Guide users through the platform
- Be friendly, professional, and concise (2-3 sentences max unless asked for details)
- Use Nigerian context (Naira ₦, local terminology)
- If asked about specific listings, encourage them to search or browse homepage
- Never make up property listings or prices

Keep responses natural and helpful. Focus on solving their problem, not just reciting facts.`
    };

    // Map messages to proper types
    const formattedMessages = messages.map(msg => ({
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content
    }));

    const chatCompletion = await this.groq.chat.completions.create({
      messages: [systemPrompt, ...formattedMessages],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
      max_tokens: 500,
      top_p: 0.9,
    });

    return {
      message: chatCompletion.choices[0].message.content,
      role: 'assistant',
    };
  }

  /**
   * Get system prompt based on property category
   * Used for step-by-step purchase guide
   */
  private getSystemPromptForCategory(category: string): string {
    const basePrompt = `You are a professional H12 Agent representing H12homes, Nigeria's trusted real estate platform. You are NOT an AI - you are a real human assistant helping customers through their property transaction. 
    
Your communication style:
- Professional but friendly and conversational
- Use simple, clear language
- Sound like a real person, not a robot
- Be warm and encouraging
- Answer directly without unnecessary explanations
- Keep messages concise (2-3 sentences max per step)
- Use Nigerian context naturally

Important:
- Your name is "H12 Agent" (not a personal name)
- You represent H12homes' corporate team
- Focus on building trust and confidence`;

    if (category === 'RENT') {
      return `${basePrompt}

PROPERTY TYPE: RENTAL

For rental properties, focus on:
- Getting the tenant verified quickly (same 4 steps apply)
- Ensuring all rental documentation is in order
- Explaining the lease terms and conditions
- Making sure utilities and maintenance responsibilities are clear
- Emphasizing secure tenancy for both parties

Key points for rental:
- Identity verification is quick (24-48 hours)
- Inspection is viewing the property
- Documentation is lease agreement and guarantor details
- Final approval means you can move in

When explaining steps, tailor to rental context.`;
    }

    if (category === 'SALE') {
      return `${basePrompt}

PROPERTY TYPE: SALE (Property Purchase)

For property sales, focus on:
- Building confidence in the buying process
- Explaining ownership transfer details
- Ensuring title deed and legal clearance
- Making the buyer feel secure about their investment
- Highlighting H12homes' transparent pricing

Key points for sales:
- Identity verification protects both buyer and seller
- Inspection is thorough property assessment
- Documentation includes title deed, ownership proof
- Final approval means the property is legally yours

When explaining steps, emphasize legal security and ownership.`;
    }

    return basePrompt;
  }

  /**
   * STEP 1: Verify Identity
   * For property purchase after payment
   */
  async explainVerificationStep(
    userName: string,
    propertyTitle: string,
    category: string,
  ): Promise<string> {
    const systemPrompt = this.getSystemPromptForCategory(category);

    const categoryContext = category === 'RENT'
      ? 'This is a rental property. The verification ensures we have a trusted tenant.'
      : 'This is a property purchase. The verification protects you and the seller.';

    const messages: Message[] = [
      {
        role: 'user',
        content: `Explain Step 1: Identity Verification in 2-3 sentences. Sound like a friendly human, not an AI.

Customer: ${userName}
Property: ${propertyTitle}
Property Type: ${categoryContext}

Be warm and reassuring. Say it takes 24-48 hours. Make them feel confident.`,
      },
    ];

    const response = await this.groq.chat.completions.create({
      messages: [
        { role: 'system' as const, content: systemPrompt },
        ...messages,
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.6,
      max_tokens: 200,
      top_p: 0.9,
    });

    return response.choices[0].message.content || '';
  }

  /**
   * STEP 2: Property Inspection
   * For property purchase after payment
   */
  async explainInspectionStep(
    userName: string,
    propertyTitle: string,
    category: string,
  ): Promise<string> {
    const systemPrompt = this.getSystemPromptForCategory(category);

    const categoryContext = category === 'RENT'
      ? 'The inspection is a viewing where the tenant sees the rental property and checks everything.'
      : 'The inspection is where you see the property in detail and verify it matches the listing.';

    const messages: Message[] = [
      {
        role: 'user',
        content: `Explain Step 2: Property Inspection in 2-3 sentences. Sound like a helpful human.

Customer: ${userName}
Property: ${propertyTitle}
Property Type: ${categoryContext}

Say H12 Agent will schedule it. Be encouraging and friendly. Takes 1-3 days.`,
      },
    ];

    const response = await this.groq.chat.completions.create({
      messages: [
        { role: 'system' as const, content: systemPrompt },
        ...messages,
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.6,
      max_tokens: 200,
      top_p: 0.9,
    });

    return response.choices[0].message.content || '';
  }

  /**
   * STEP 3: Documentation & Legal Review
   * For property purchase after payment
   */
  async explainDocumentationStep(
    userName: string,
    category: string,
  ): Promise<string> {
    const systemPrompt = this.getSystemPromptForCategory(category);

    const categoryContext = category === 'RENT'
      ? 'Documents needed: lease agreement, guarantor details, proof of income/employment.'
      : 'Documents needed: title deed, ownership verification, land registry checks, no-debt certificates.';

    const messages: Message[] = [
      {
        role: 'user',
        content: `Explain Step 3: Documentation & Legal Review in 2-3 sentences. Sound like a real assistant.

Customer: ${userName}
Property Type: ${categoryContext}

Say H12 Agent will help gather documents. Be reassuring about security. Takes 2-5 days.`,
      },
    ];

    const response = await this.groq.chat.completions.create({
      messages: [
        { role: 'system' as const, content: systemPrompt },
        ...messages,
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.6,
      max_tokens: 200,
      top_p: 0.9,
    });

    return response.choices[0].message.content || '';
  }

  /**
   * STEP 4: Final Approval
   * For property purchase after payment
   */
  async explainFinalApprovalStep(
    userName: string,
    category: string,
  ): Promise<string> {
    const systemPrompt = this.getSystemPromptForCategory(category);

    const categoryContext = category === 'RENT'
      ? 'You can now move into your rental property.'
      : 'The property is now legally yours.';

    const messages: Message[] = [
      {
        role: 'user',
        content: `Explain Step 4: Final Approval in 2-3 sentences. Sound human and celebratory.

Customer: ${userName}
What happens: ${categoryContext}

Be warm and congratulatory. Takes 1-2 days. Make them excited about next steps.`,
      },
    ];

    const response = await this.groq.chat.completions.create({
      messages: [
        { role: 'system' as const, content: systemPrompt },
        ...messages,
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.6,
      max_tokens: 200,
      top_p: 0.9,
    });

    return response.choices[0].message.content || '';
  }

  /**
   * Helper: Build messages with system prompt
   */
  private buildMessages(systemPrompt: string, userMessages: Message[]): Message[] {
    return [
      {
        role: 'system',
        content: systemPrompt,
      },
      ...userMessages,
    ];
  }

/**
 * Generate AI response for property chat - TIGHT CONSTRAINTS
 * Used by AI Agent during chat phase ONLY
 * This AI should ONLY ask about buyer preferences, never go off-script
 */
async generateAIResponse(chatId: string, userMessage: string): Promise<string> {
  try {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        property: {
          select: {
            title: true,
            price: true,
            location: true,
            bedrooms: true,
            bathrooms: true,
            category: true,
          },
        },
      },
    });

    if (!chat?.property) {
      return "I need to load the property details. Please try again.";
    }

    // Count conversation turns to know when to push for unlock keyword
    const messageCount = await this.prisma.chatMessage.count({
      where: { 
        chatId,
        senderId: AI_USER_ID, // Count only AI messages
      },
    });

    // Get last user message for context
    const lastMessages = await this.prisma.chatMessage.findMany({
      where: { chatId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Build conversation - ONLY between user and AI
    const conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = 
      lastMessages
        .reverse()
        .filter(msg => msg.senderId !== AI_USER_ID || !msg.message.includes('Connecting you')) // Skip transfer messages
        .map(msg => ({
          role: msg.senderId === AI_USER_ID ? 'assistant' : 'user',
          content: msg.message,
        }));

    // TIGHT SYSTEM PROMPT - No fluff, no generic advice
    const systemPrompt = `You are an AI property assistant for H12 Homes. 

YOUR ONLY JOB:
1. Ask about buyer's priority for THIS SPECIFIC PROPERTY (location, amenities, price, size, safety)
2. Acknowledge their preference
3. After 2-3 exchanges, gently push them toward: "Ready to meet your agent?"

PROPERTY DETAILS (DO NOT INVENT):
- Property: ${chat.property.title}
- Price: ₦${Number(chat.property.price || 0).toLocaleString()}
- Location: ${chat.property.location}
- Bedrooms: ${chat.property.bedrooms ?? 'Not specified'}
- Bathrooms: ${chat.property.bathrooms ?? 'Not specified'}

RULES (STRICT):
- Keep replies to 2 sentences MAX
- Only ask about THIS property, never give generic real estate advice
- Don't mention H12 locations, corporate structure, or company values
- Don't answer questions about other properties or general real estate
- If user asks something outside this property, redirect: "That's outside my scope - let me connect you with the agent"
- Never make up property details
- After 3 AI turns, subtly push: "Sounds like you know what you want! Ready to meet your dedicated agent?"

DO NOT:
- Explain company locations or structure
- Give buying/renting advice
- Discuss payment or contracts
- Answer about OTHER properties
- Be overly friendly or use emojis

BE:
- Professional
- Direct
- Property-focused`;

    // If we've had 4+ turns, push toward unlock
    let finalPrompt = userMessage;
    if (messageCount >= 4) {
      finalPrompt = `${userMessage}

(Note: This is exchange ${messageCount}. If they seem ready, gently push: "Ready to connect with your agent?")`;
    }

    const chatCompletion = await this.groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        ...conversationHistory,
        { role: 'user', content: finalPrompt },
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.5, // LOWER temperature = more consistent, less creative
      max_tokens: 150, // SHORTER responses
      top_p: 0.8, // TIGHTER sampling
    });

    let response =
      chatCompletion.choices?.[0]?.message?.content ||
      "Ready to meet your agent? Just reply with: **I'm ready to meet my agent**";

    // SAFETY: If response is too long, truncate
    if (response.length > 300) {
      response = response.substring(0, 300) + '...';
    }

    // SAFETY: Never suggest generic platform features
    if (response.toLowerCase().includes('search') || 
        response.toLowerCase().includes('homepage') ||
        response.toLowerCase().includes('browse')) {
      response = "Ready to speak with your agent? Reply: **I'm ready to meet my agent**";
    }

    return response;

  } catch (error) {
    console.error('Error generating AI response:', error);
    return "Let me connect you with your agent. Reply: **I'm ready to meet my agent**";
  }
}
}