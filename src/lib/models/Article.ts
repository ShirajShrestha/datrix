import mongoose, { Schema, Document } from 'mongoose';

export interface IArticle extends Document {
  title: string;
  url: string;
  source: string;
  category: string;
  publishedAt: Date;
  importanceScore: number;
  topics: string[];
  summary: {
    tldr: string;
    bullets: string[];
    whyItMatters: string;
  };
  isSaved: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ArticleSchema = new Schema<IArticle>(
  {
    title: { type: String, required: true },
    url: { type: String, required: true, unique: true },
    source: { type: String, required: true },
    category: { type: String, required: true, index: true },
    publishedAt: { type: Date, required: true, index: true },
    importanceScore: { type: Number, required: true, index: true },
    topics: [{ type: String }],
    summary: {
      tldr: { type: String },
      bullets: [{ type: String }],
      whyItMatters: { type: String },
    },
    isSaved: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

ArticleSchema.index({ title: 'text' });
ArticleSchema.index({ category: 1, importanceScore: -1 });
ArticleSchema.index({ publishedAt: -1 });

export const Article = mongoose.models.Article || mongoose.model<IArticle>('Article', ArticleSchema);
