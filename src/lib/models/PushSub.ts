import mongoose, { Schema, Document } from 'mongoose';
import { CATEGORIES, type CategorySlug } from '@/lib/categories';
import { localParts } from '@/lib/services/push';

/**
 * Subscription expiry (TTL on expireAt), an anti-abuse measure: anyone can POST /api/push/subscribe
 * with a syntactically valid endpoint, so a new row lives only 14 days unless a push is actually
 * delivered (cron/push or a test send), which moves expireAt to 90 days. Re-subscribing an
 * existing endpoint never changes expireAt. Real users get their first push within a day.
 */
export const UNCONFIRMED_SUB_TTL_MS = 14 * 24 * 60 * 60 * 1000;
export const CONFIRMED_SUB_TTL_MS = 90 * 24 * 60 * 60 * 1000;

const SLUGS = new Set<string>(CATEGORIES.map((c) => c.slug));

export interface IPushSub extends Document {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  categories: CategorySlug[];
  time: string;
  timeZone: string;
  lastSentDate?: string;
  lastTestAt?: Date;
  failCount?: number;
  lastFailDate?: string;
  expireAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PushSubSchema = new Schema<IPushSub>(
  {
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    categories: {
      type: [{ type: String }],
      default: [],
      validate: {
        validator: (v: string[]) => Array.isArray(v) && v.every((x) => SLUGS.has(x)),
        message: 'categories must contain only known category slugs',
      },
    },
    time: {
      type: String,
      required: true,
      default: '08:00',
      match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'time must be HH:MM'],
    },
    timeZone: {
      type: String,
      required: true,
      validate: {
        validator: (v: string) => localParts(new Date(), v) !== null,
        message: 'timeZone must be a valid IANA zone',
      },
    },
    lastSentDate: { type: String, match: [/^\d{4}-\d{2}-\d{2}$/, 'lastSentDate must be YYYY-MM-DD'] },
    lastTestAt: { type: Date },
    failCount: { type: Number, default: 0 },
    lastFailDate: { type: String },
    expireAt: { type: Date },
  },
  { timestamps: true },
);

// Rows created before this field existed have no expireAt and are never expired by the TTL.
PushSubSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

export const PushSub = mongoose.models.PushSub || mongoose.model<IPushSub>('PushSub', PushSubSchema);
