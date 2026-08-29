/**
 * sessions.ts | which day log column a study block's minutes land in.
 *
 * Shared by the stop and manual endpoints so a block can never be counted into
 * one column by the timer and a different one by a manual entry.
 */


export const MINUTE_COLUMN: Record<string, string | undefined> = {
  DSA: 'dsa_minutes',
  LEARN: 'learn_minutes',
  BUILD: 'build_minutes',
  MONEY: 'money_minutes',
};

export const SESSION_BLOCKS = ['DSA', 'LEARN', 'BUILD', 'CLOSE', 'MONEY', 'NIGHT'] as const;
