/**
 * schemas.ts | the write schemas shared by a create route and its update route.
 *
 * A lead, a deal, a care plan and an application are each created by one route
 * and edited by another. Keeping one schema means the two can never drift, which
 * is how a field ends up writable on PATCH but validated only on POST.
 */

import {
  httpUrl,
  isoDate,
  optionalHttpUrl,
  optionalText,
  positiveId,
  rupees,
  z,
} from './validate';

/* ------------------------------------------------------------------ email */

/**
 * The one email rule. Used by sign in and sign up, which have to agree: a value
 * one accepts and the other rejects is an account nobody can log into.
 */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(5)
  .max(255)
  .refine((v) => /^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/.test(v), {
    message: 'That is not a valid email address.',
  });

/* --------------------------------------------------- resource and week link */

/**
 * Progress against a library row or a week link.
 *
 * The Express build had one schema serving both endpoints. They are separate route
 * files now, so the schema lives here rather than being written out twice, because
 * two copies is how `rating` ends up accepted on one and refused on the other.
 */
export const linkProgressBody = z.object({
  status: z.enum(['todo', 'reading', 'done']).optional(),
  minutes: z.coerce.number().int().min(0).max(100000).optional(),
  rating: z.union([z.coerce.number().int().min(1).max(5), z.null()]).optional(),
  notes: optionalText(4000).optional(),
});

/* ------------------------------------------------------------------ leads */

export const LEAD_STATUSES = ['new', 'touched', 'replied', 'quoted', 'won', 'lost', 'dead'] as const;

export const leadBody = z.object({
  name: z.string().trim().min(1).max(200),
  category: optionalText(120),
  area: optionalText(120),
  phone: optionalText(32),
  website: optionalHttpUrl,
  mobile_broken: z.boolean().optional(),
  rating: z.union([z.coerce.number().min(0).max(5), z.null()]).optional(),
  reviews: z.union([z.coerce.number().int().min(0).max(100000), z.null()]).optional(),
  status: z.enum(LEAD_STATUSES).optional(),
  next_touch_on: z.union([isoDate, z.null()]).optional(),
  notes: optionalText(4000),
});

/** The column names a lead PATCH may set, in the order the schema declares them. */
export const LEAD_FIELDS = Object.keys(leadBody.shape) as (keyof typeof leadBody.shape)[];

/* ------------------------------------------------------------------ deals */

export const DEAL_STATUSES = [
  'quoted',
  'advance_paid',
  'in_delivery',
  'delivered',
  'paid',
  'refunded',
  'dead',
] as const;

export const dealBody = z.object({
  lead_id: z.union([positiveId, z.null()]).optional(),
  client_name: z.string().trim().min(1).max(200),
  offer_code: z.string().regex(/^O[1-8]$/),
  price: rupees,
  advance_amount: z.union([rupees, z.null()]).optional(),
  advance_on: z.union([isoDate, z.null()]).optional(),
  delivery_due: z.union([isoDate, z.null()]).optional(),
  delivered_on: z.union([isoDate, z.null()]).optional(),
  balance_amount: z.union([rupees, z.null()]).optional(),
  balance_on: z.union([isoDate, z.null()]).optional(),
  status: z.enum(DEAL_STATUSES).optional(),
  referral_asked: z.boolean().optional(),
  notes: optionalText(4000),
});

export const DEAL_FIELDS = Object.keys(dealBody.shape) as (keyof typeof dealBody.shape)[];

/* ------------------------------------------------------------- care plans */

export const carePlanBody = z.object({
  client_name: z.string().trim().min(1).max(200),
  monthly_amount: rupees,
  started_on: isoDate,
  active: z.boolean().optional(),
  last_invoice_on: z.union([isoDate, z.null()]).optional(),
  notes: optionalText(4000),
});

export const CARE_PLAN_FIELDS = Object.keys(carePlanBody.shape) as (keyof typeof carePlanBody.shape)[];

/* ----------------------------------------------------------- applications */

export const APPLICATION_STATUSES = [
  'applied',
  'screen',
  'tech',
  'onsite',
  'offer',
  'rejected',
  'ghosted',
] as const;

export const applicationBody = z.object({
  company: z.string().trim().min(1).max(200),
  role_title: z.string().trim().min(1).max(200),
  role_code: optionalText(8),
  source: optionalText(120),
  applied_on: isoDate,
  status: z.enum(APPLICATION_STATUSES).optional(),
  last_update: z.union([isoDate, z.null()]).optional(),
  referral: z.boolean().optional(),
  salary_offered: optionalText(120),
  jd_url: z.union([httpUrl, z.literal(''), z.null()]).optional(),
  notes: optionalText(4000),
});

export const APPLICATION_FIELDS = Object.keys(
  applicationBody.shape
) as (keyof typeof applicationBody.shape)[];
