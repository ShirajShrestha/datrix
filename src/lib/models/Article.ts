import mongoose, { Schema, Document } from 'mongoose';
import type { CategorySlug } from '@/lib/categories';

export interface IArticle extends Document {
  title: string;
  url: string;
  source: string;
  categories: CategorySlug[];
  imageUrl?: string;
  sources: { name: string; url: string }[];
  publishedAt: Date;
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
    categories: { type: [{ type: String }], required: true },
    imageUrl: { type: String },
    sources: [{ _id: false, name: { type: String, required: true }, url: { type: String, required: true } }],
    publishedAt: { type: Date, required: true },
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
// TTL: articles expire 30 days after publishedAt
ArticleSchema.index({ publishedAt: 1 }, { expireAfterSeconds: 2592000 });

export const Article = mongoose.models.Article || mongoose.model<IArticle>('Article', ArticleSchema);
