import { eq } from 'drizzle-orm';
import { getDb, schema } from '../db/client';
import { createLogger } from '../utils/logger';

const log = createLogger('streak-service');

// Badge definitions
const BADGES = {
  FIRST_TIP: { code: 'first_tip', emoji: '🌱', label: 'First Tip' },
  STREAK_3: { code: 'streak_3', emoji: '🔥', label: '3-Day Streak' },
  STREAK_7: { code: 'streak_7', emoji: '⚡', label: '7-Day Streak' },
  STREAK_30: { code: 'streak_30', emoji: '💎', label: '30-Day Streak' },
  TIPS_10: { code: 'tips_10', emoji: '🎯', label: '10 Tips Sent' },
  TIPS_50: { code: 'tips_50', emoji: '🏅', label: '50 Tips Sent' },
  TIPS_100: { code: 'tips_100', emoji: '👑', label: 'Century Tipper' },
  BIG_TIPPER: { code: 'big_tipper', emoji: '💸', label: 'Big Tipper ($50+)' },
  GOLD_TIPPER: { code: 'gold_tipper', emoji: '🥇', label: 'Gold Tipper (XAUT)' },
} as const;

export class StreakService {
  /**
   * Record a tip and update streak + badges
   */
  async recordTip(userId: number, amount: number, asset: string): Promise<{ newBadges: string[] }> {
    const db = getDb();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let streak = await db.query.tipStreaks.findFirst({
      where: eq(schema.tipStreaks.userId, userId),
    });

    const newBadges: string[] = [];

    if (!streak) {
      // First ever tip
      await db.insert(schema.tipStreaks).values({
        userId,
        currentStreak: 1,
        longestStreak: 1,
        totalTipDays: 1,
        lastTipDate: today,
        badges: BADGES.FIRST_TIP.code,
      });
      newBadges.push(`${BADGES.FIRST_TIP.emoji} ${BADGES.FIRST_TIP.label}`);
      return { newBadges };
    }

    // Check if already tipped today
    const lastDate = streak.lastTipDate ? new Date(streak.lastTipDate) : null;
    const lastDay = lastDate ? new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate()) : null;

    if (lastDay && lastDay.getTime() === today.getTime()) {
      // Already tipped today, just check amount-based badges
      return { newBadges: this.checkAmountBadges(streak.badges, amount, asset) };
    }

    // Calculate streak
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let newStreak: number;
    if (lastDay && lastDay.getTime() === yesterday.getTime()) {
      // Consecutive day
      newStreak = streak.currentStreak + 1;
    } else {
      // Streak broken
      newStreak = 1;
    }

    const longestStreak = Math.max(newStreak, streak.longestStreak);
    const totalTipDays = streak.totalTipDays + 1;
    let badges = streak.badges;

    // Check streak badges
    if (newStreak >= 3 && !badges.includes(BADGES.STREAK_3.code)) {
      badges += `,${BADGES.STREAK_3.code}`;
      newBadges.push(`${BADGES.STREAK_3.emoji} ${BADGES.STREAK_3.label}`);
    }
    if (newStreak >= 7 && !badges.includes(BADGES.STREAK_7.code)) {
      badges += `,${BADGES.STREAK_7.code}`;
      newBadges.push(`${BADGES.STREAK_7.emoji} ${BADGES.STREAK_7.label}`);
    }
    if (newStreak >= 30 && !badges.includes(BADGES.STREAK_30.code)) {
      badges += `,${BADGES.STREAK_30.code}`;
      newBadges.push(`${BADGES.STREAK_30.emoji} ${BADGES.STREAK_30.label}`);
    }

    // Check total tips badges
    if (totalTipDays >= 10 && !badges.includes(BADGES.TIPS_10.code)) {
      badges += `,${BADGES.TIPS_10.code}`;
      newBadges.push(`${BADGES.TIPS_10.emoji} ${BADGES.TIPS_10.label}`);
    }
    if (totalTipDays >= 50 && !badges.includes(BADGES.TIPS_50.code)) {
      badges += `,${BADGES.TIPS_50.code}`;
      newBadges.push(`${BADGES.TIPS_50.emoji} ${BADGES.TIPS_50.label}`);
    }
    if (totalTipDays >= 100 && !badges.includes(BADGES.TIPS_100.code)) {
      badges += `,${BADGES.TIPS_100.code}`;
      newBadges.push(`${BADGES.TIPS_100.emoji} ${BADGES.TIPS_100.label}`);
    }

    // Amount-based badges
    const amountBadges = this.checkAmountBadges(badges, amount, asset);
    if (amountBadges.length > 0) {
      for (const b of amountBadges) {
        newBadges.push(b);
      }
    }

    // Rebuild badges string (may have been modified by amount check)
    let finalBadges = badges;
    if (amount >= 50 && !finalBadges.includes(BADGES.BIG_TIPPER.code)) {
      finalBadges += `,${BADGES.BIG_TIPPER.code}`;
    }
    if (asset === 'XAUT' && !finalBadges.includes(BADGES.GOLD_TIPPER.code)) {
      finalBadges += `,${BADGES.GOLD_TIPPER.code}`;
    }

    await db.update(schema.tipStreaks)
      .set({
        currentStreak: newStreak,
        longestStreak,
        totalTipDays,
        lastTipDate: today,
        badges: finalBadges,
      })
      .where(eq(schema.tipStreaks.userId, userId));

    log.info({ userId, streak: newStreak, newBadges: newBadges.length }, 'Streak updated');
    return { newBadges };
  }

  private checkAmountBadges(currentBadges: string, amount: number, asset: string): string[] {
    const newBadges: string[] = [];
    if (amount >= 50 && !currentBadges.includes(BADGES.BIG_TIPPER.code)) {
      newBadges.push(`${BADGES.BIG_TIPPER.emoji} ${BADGES.BIG_TIPPER.label}`);
    }
    if (asset === 'XAUT' && !currentBadges.includes(BADGES.GOLD_TIPPER.code)) {
      newBadges.push(`${BADGES.GOLD_TIPPER.emoji} ${BADGES.GOLD_TIPPER.label}`);
    }
    return newBadges;
  }

  /**
   * Get streak info for a user
   */
  async getStreak(userId: number): Promise<{
    currentStreak: number;
    longestStreak: number;
    totalTipDays: number;
    badges: { emoji: string; label: string }[];
    reputationMultiplier: number;
  }> {
    const streak = await getDb().query.tipStreaks.findFirst({
      where: eq(schema.tipStreaks.userId, userId),
    });

    if (!streak) {
      return { currentStreak: 0, longestStreak: 0, totalTipDays: 0, badges: [], reputationMultiplier: 1.0 };
    }

    const badgeCodes = streak.badges.split(',').filter(Boolean);
    const allBadges = Object.values(BADGES);
    const badges = badgeCodes
      .map(code => allBadges.find(b => b.code === code))
      .filter(Boolean)
      .map(b => ({ emoji: b!.emoji, label: b!.label }));

    // Streak multiplier: 1.0 base + 0.1 per streak day (max 3.0x)
    const reputationMultiplier = Math.min(3.0, 1.0 + (streak.currentStreak * 0.1));

    return {
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      totalTipDays: streak.totalTipDays,
      badges,
      reputationMultiplier,
    };
  }
}

export const streakService = new StreakService();
