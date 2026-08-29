/**
 * deals.ts | the Part 17 rules a deal has to satisfy before it is written.
 *
 * Shared by POST /api/deals and PATCH /api/deals/:id, so an edit can never move a
 * deal into a state a create would have refused.
 */

import { getOffers, getWeeks } from './reference';
import { offerLocked } from '../money';
import { notFound, ruleViolation } from '../errors';
import { todayInTz } from '../dates';
import type { Row } from './pool';

export async function assertDealRules(
  body: Record<string, any>,
  existing: Record<string, any> = {}
): Promise<Row> {
  const merged = { ...existing, ...body };

  const offers = await getOffers();
  const offer = offers.find((o) => o.code === merged.offer_code);
  if (!offer) throw notFound('No such offer code.');

  const today = todayInTz();
  const weeks = await getWeeks();
  const week = weeks.find((w) => today >= w.start_date && today <= w.end_date);

  const lock = offerLocked(
    offer as { code: string; unlocked_from_week?: number | null },
    week?.n ?? 0
  );
  if (lock.locked) throw ruleViolation(lock.reason!);

  if (Number(merged.price) < Number(offer.price_low)) {
    throw ruleViolation(
      `${offer.code} has a floor of Rs ${Number(offer.price_low).toLocaleString(
        'en-IN'
      )}. Quote at the top of the band, settle in the middle, never go under the floor.`
    );
  }

  const status = merged.status ?? 'quoted';
  if (['in_delivery', 'delivered', 'paid'].includes(status)) {
    if (!merged.advance_on || !Number(merged.advance_amount)) {
      throw ruleViolation(
        'Fifty per cent advance before you start. No advance, no work. A deal cannot move to delivery without an advance date and an advance amount.'
      );
    }
  }
  if (status === 'paid' && !merged.balance_on) {
    throw ruleViolation('A deal cannot be marked paid without a balance date.');
  }

  return offer;
}
