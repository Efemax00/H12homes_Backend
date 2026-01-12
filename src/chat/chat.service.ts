import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';

@Injectable()
export class ChatService {
  private groq: Groq;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GROQ_API_KEY');
    this.groq = new Groq({ apiKey });
  }

  async sendMessage(messages: Array<{ role: string; content: string }>) {
    const systemPrompt = {
      role: 'system' as const,
      content: `You are a helpful real estate assistant for H12homes, a property platform in Nigeria. 

Your role:
- Help users find properties (houses, apartments, hotels, household items)
- Answer questions about buying, renting, and property listings
- Guide users through the platform
- Be friendly, professional, and concise
- Use Nigerian context (prices in Naira ₦, locations in Nigeria)
- If asked about specific listings, encourage users to use the search feature or browse the homepage
- Never make up property listings or prices

Important:
- We operate in Delta State (Warri, Ughelli, Asaba, Agbarho, Ogwashi-Uku)
- Expanding to Lagos, Abuja, Port Harcourt, and other cities soon
- Users must login to contact sellers
- We don't handle payments yet - contact is via WhatsApp
- Keep responses short (2-3 sentences max unless asked for details)`,
    };

    // Map messages to proper types
    const formattedMessages = messages.map((msg) => ({
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content,
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
}
