'use client';

/**
 * MoneyOffers | Part 17.4. The price band is the price band.
 */

import { EmptyState, Section } from '@/components/ui/Basics';
import type { MoneySummary, OfferRow } from './types';

function OfferCard({ o }: { o: OfferRow }) {
  return (
    <div className={`offercard ${o.locked ? 'offercard--locked' : ''}`}>
      <div className="row">
        <span className="offercard__code">{o.code}</span>
        <strong className="grow">{o.name}</strong>
        {o.is_recurring ? <span className="badge badge--green">Recurring</span> : null}
        {o.locked ? (
          <span className="badge badge--red">{`Locked until week ${o.unlocked_from_week}`}</span>
        ) : null}
      </div>
      <span className="offercard__price">{o.price_band_text}</span>
      <p className="text-sm">{o.scope}</p>
      <p className="text-xs muted">{`Delivery ${o.delivery}`}</p>
      {o.locked ? <p className="text-xs measure">{o.reason}</p> : null}
    </div>
  );
}

export function MoneyOffers({ summary }: { summary: MoneySummary }) {
  const offers = summary.offers ?? [];

  return (
    <Section title="The eight offers" lede="Part 17.4. The price band is the price band.">
      {offers.length ? (
        <div className="grid grid--3">
          {offers.map((o) => (
            <OfferCard key={o.code} o={o} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No offers"
          body="The eight offers come from Part 17.4 of final.md. Run npm run setup."
        />
      )}
      <p className="text-sm muted measure">
        Quote at the top of the band, settle in the middle, never go under the floor. A locked offer
        stays locked: selling retrieval before you have built it once in Project 4 costs a week of
        study time repaying the mistake.
      </p>
    </Section>
  );
}

export default MoneyOffers;
