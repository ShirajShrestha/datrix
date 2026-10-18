import mongoose, { Schema, Document } from 'mongoose';
import { CATEGORIES, type CategorySlug } from '@/lib/categories';

const SLUGS = new Set<string>(CATEGORIES.map((c) => c.slug));
const DAY_MS = 24 * 60 * 60 * 1000;

export interface IArticle extends Document {
  title: string;
  url: string;
  source: string;
  categories: CategorySlug[];
  imageUrl?: string;
  sources: { name: string; url: string }[];
  publishedAt: Date;
  expireAt?: Date;
  importanceScore: number;
  topics: string[];
  summary?: {
    tldr: string;
    bullets: string[];
    whyItMatters?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const ArticleSchema = new Schema<IArticle>(
  {
    title: { type: String, required: true },
    url: { type: String, required: true, unique: true },
    source: { type: String, required: true },
    categories: {
      type: [{ type: String }],
      required: true,
      validate: {
        validator: (v: string[]) => Array.isArray(v) && v.length > 0 && v.every((x) => SLUGS.has(x)),
        message: 'categories must be a non-empty array of known category slugs',
      },
    },
    imageUrl: { type: String },
    sources: [{ _id: false, name: { type: String, required: true }, url: { type: String, required: true } }],
    publishedAt: { type: Date, required: true },
    // TTL field. Default only applies to new Article() docs; bulk upserts (bulkWrite/updateOne
    // with upsert) bypass schema defaults, so ingest sets expireAt explicitly on every upsert, with `setDefaultsOnInsert:false` on the ops and
    // bulkWrite `throwOnValidationError:true` (otherwise Mongoose silently drops ops that fail casting).
    expireAt: {
      type: Date,
      default(this: { publishedAt?: Date } | null) {
        const now = Date.now();
        if (!this?.publishedAt) return new Date(now + 30 * DAY_MS);
        return new Date(Math.max(new Date(this.publishedAt).getTime() + 30 * DAY_MS, now + DAY_MS));
      },
    },
    importanceScore: { type: Number, required: true },
    topics: [{ type: String }],
    summary: {
      tldr: { type: String },
      bullets: [{ type: String }],
      whyItMatters: { type: String },
    },
  },
  {
    timestamps: true,
  }
);

ArticleSchema.index({ title: 'text' });
ArticleSchema.index({ categories: 1, importanceScore: -1 });
ArticleSchema.index({ publishedAt: -1 });
// TTL lives on a dedicated field: existing prod publishedAt indexes are non-TTL and would conflict.
ArticleSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

export const Article = mongoose.models.Article || mongoose.model<IArticle>('Article', ArticleSchema);
