import { model, Schema, type InferSchemaType } from 'mongoose';

import { SPECIALIZATIONS } from '../../../../domain/doctor/doctor.entity.js';

const doctorSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    /** Denormalized lowercase name: lets case-insensitive prefix search and sort use an index. */
    nameLower: { type: String, required: true },
    specialization: { type: String, required: true, enum: SPECIALIZATIONS },
    hospital: { type: String, required: true, trim: true, maxlength: 160 },
    phone: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
  },
  { timestamps: true, versionKey: false, collection: 'doctors' },
);

/*
 * Index strategy (ESR: Equality → Sort → Range):
 * - email unique: identity + duplicate protection under concurrency.
 * - nameLower: anchored prefix search and name sorting.
 * - specialization / hospital + createdAt: equality (or `$in` for several values) filter, then
 *   sort/range by date.
 * - createdAt: default listing order and date-range filters.
 */
doctorSchema.index({ email: 1 }, { unique: true });
doctorSchema.index({ nameLower: 1 });
doctorSchema.index({ specialization: 1, createdAt: -1 });
doctorSchema.index({ hospital: 1, createdAt: -1 });
doctorSchema.index({ createdAt: -1 });

export type DoctorRecord = InferSchemaType<typeof doctorSchema>;

export const DoctorModel = model('Doctor', doctorSchema);
