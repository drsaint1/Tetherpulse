import { GoogleGenerativeAI } from '@google/generative-ai';
import { getEnv } from '../config/env';
import { createLogger } from '../utils/logger';

const log = createLogger('ai-service');

export interface TipIntent {
  recipient: string;    // @username or display name
  amount: number;
  asset: 'USDT' | 'XAUT';
  reason: string | null;
}

export interface ContributionScore {
  score: number;          // 0-100
  category: string;       // 'technical_help' | 'community' | 'resource_sharing' | 'mentoring' | 'other'
  reason: string;
}

export interface DigestData {
  summary: string;
  topContributors: string[];
  highlights: string[];
  tipCount: number;
  totalVolume: number;
}

let _genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!_genAI) {
    _genAI = new GoogleGenerativeAI(getEnv().GEMINI_API_KEY);
  }
  return _genAI;
}

export class AIService {
  private model = 'gemini-2.0-flash';

  /**
   * Parse a chat message for tipping intent.
   * Returns null if the message is not a tip command.
   */
  async parseTipIntent(message: string, senderUsername: string): Promise<TipIntent | null> {
    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({ model: this.model });

    const prompt = `You are a tip parsing assistant. Analyze this chat message and determine if it contains a tipping intent.

A tipping message typically contains:
- A mention of "tip", "send", "give", or similar action words
- A recipient (usually @username)
- An amount (number)
- An asset (USDT/USDt or XAUT/XAU₮/gold). Default to USDT if not specified.
- Optionally a reason

Message from @${senderUsername}: "${message}"

Respond with ONLY valid JSON in this exact format:
- If it IS a tip: {"isTip": true, "recipient": "@username", "amount": 5.00, "asset": "USDT", "reason": "for helping with the bug"}
- If it is NOT a tip: {"isTip": false}

Rules:
- recipient should include the @ prefix if present in the message
- amount must be a positive number
- asset must be either "USDT" or "XAUT"
- reason can be null if not provided
- Do not hallucinate recipients or amounts not in the message`;

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();

      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        log.debug({ message }, 'No JSON found in AI response');
        return null;
      }

      const parsed = JSON.parse(jsonMatch[0]);

      if (!parsed.isTip) return null;

      const intent: TipIntent = {
        recipient: parsed.recipient,
        amount: parseFloat(parsed.amount),
        asset: parsed.asset === 'XAUT' ? 'XAUT' : 'USDT',
        reason: parsed.reason || null,
      };

      // Validate
      if (!intent.recipient || isNaN(intent.amount) || intent.amount <= 0) {
        log.debug({ parsed }, 'Invalid tip intent from AI');
        return null;
      }

      log.info({ intent }, 'Tip intent parsed');
      return intent;
    } catch (error) {
      log.error({ error, message }, 'Failed to parse tip intent');
      return null;
    }
  }

  /**
   * Score a message for contribution quality (0-100).
   * Only called on sampled messages that pass pre-filters.
   */
  async scoreContribution(message: string, username: string, chatContext?: string): Promise<ContributionScore | null> {
    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({ model: this.model });

    const prompt = `You are a community contribution evaluator. Score this message for its helpfulness and value to the community.

Message from @${username}: "${message}"
${chatContext ? `Recent chat context: ${chatContext}` : ''}

Score from 0-100 based on:
- Technical help / answering questions: high value (70-100)
- Sharing useful resources/links: medium-high value (60-85)
- Thoughtful community discussion: medium value (50-70)
- Mentoring / detailed explanations: high value (75-100)
- Short replies, greetings, emoji-only: low value (0-20)
- Spam, self-promotion: 0

Respond with ONLY valid JSON:
{"score": 85, "category": "technical_help", "reason": "Provided detailed solution to user's deployment issue"}

Categories: technical_help, community, resource_sharing, mentoring, other`;

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      const parsed = JSON.parse(jsonMatch[0]);

      const score: ContributionScore = {
        score: Math.max(0, Math.min(100, parseInt(parsed.score))),
        category: parsed.category || 'other',
        reason: parsed.reason || '',
      };

      log.debug({ username, score: score.score, category: score.category }, 'Contribution scored');
      return score;
    } catch (error) {
      log.error({ error }, 'Failed to score contribution');
      return null;
    }
  }

  /**
   * Generate a daily digest summary for a chat
   */
  async generateDigest(
    chatName: string,
    messages: { username: string; text: string }[],
    tipsSummary: { count: number; totalVolume: number; topTippers: string[]; topReceivers: string[] },
  ): Promise<string> {
    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({ model: this.model });

    const messagesSample = messages.slice(0, 50).map(m => `@${m.username}: ${m.text}`).join('\n');

    const prompt = `Generate a fun, concise daily digest for the "${chatName}" community chat.

Today's stats:
- Tips sent: ${tipsSummary.count}
- Total volume: $${tipsSummary.totalVolume.toFixed(2)}
- Top tippers: ${tipsSummary.topTippers.join(', ') || 'None'}
- Top receivers: ${tipsSummary.topReceivers.join(', ') || 'None'}

Sample of today's messages:
${messagesSample}

Write a brief, engaging summary (max 500 chars) that:
1. Highlights key discussions and helpful contributions
2. Celebrates top contributors
3. Mentions tipping activity
4. Ends with an encouraging note

Use emoji sparingly. Keep it professional but friendly.`;

    try {
      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    } catch (error) {
      log.error({ error }, 'Failed to generate digest');
      return `Daily Digest for ${chatName}: ${tipsSummary.count} tips totaling $${tipsSummary.totalVolume.toFixed(2)} were sent today. Keep contributing!`;
    }
  }

  /**
   * Determine suggested tip amount based on contribution score
   */
  getSuggestedTipAmount(score: number): { amount: number; asset: 'USDT' } {
    if (score >= 90) return { amount: 5, asset: 'USDT' };
    if (score >= 80) return { amount: 2, asset: 'USDT' };
    return { amount: 1, asset: 'USDT' };
  }

  /**
   * Generate a conversational reply to a general message.
   * The bot acts as TetherPulse — a helpful, friendly AI tipping assistant.
   */
  async chatReply(message: string, username: string): Promise<string> {
    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({ model: this.model });

    const prompt = `You are TetherPulse, an AI-powered tipping bot on Telegram. You help users send crypto tips (USDT and XAUT gold) to reward helpful community members.

Your capabilities:
- Send tips: "tip @user 5 USDT" or use /tip command
- Check balances: /balance
- View leaderboard: /leaderboard
- Check reputation: /reputation
- Support USDT on Polygon Amoy & Arbitrum Sepolia (testnet)
- Support XAU₮ (gold token) on Polygon & Arbitrum
- AI-powered: you detect tip intents in natural language and score community contributions

User @${username} says: "${message}"

Reply in 1-3 short sentences. Be helpful, friendly, and concise. If they're asking how to use you, guide them. If they're greeting you, greet back warmly. If they seem confused, suggest a command. Don't use markdown formatting. Keep it casual.`;

    try {
      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    } catch (error) {
      log.error({ error }, 'Failed to generate chat reply');
      return "Hey! I'm TetherPulse. Try /help to see what I can do, or just say \"tip @someone 5 USDT\" to send a tip!";
    }
  }
}

export const aiService = new AIService();
