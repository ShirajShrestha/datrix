import mongoose, { Schema } from 'mongoose';

/** One document per hour bucket counting brief generation claims; TTL-expired. Never touches Article. */
const BriefBudgetSchema = new Schema({
  _id: { type: String, required: true },
  count: { type: Number, default: 0 },
  expireAt: { type: Date, required: true },
});
BriefBudgetSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

export const BriefBudget = mongoose.models.BriefBudget || mongoose.model('BriefBudget', BriefBudgetSchema);
