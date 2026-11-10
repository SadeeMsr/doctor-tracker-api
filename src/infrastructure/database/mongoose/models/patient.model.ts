import { model, Schema, type InferSchemaType } from 'mongoose';

import { GENDERS, PATIENT_CONDITIONS } from '../../../../domain/patient/patient.entity.js';

const patientSchema = new Schema(
  {
    /** Reference, not an embedded array on the doctor: a doctor's patient list is unbounded. */
    doctorId: { type: Schema.Types.ObjectId, required: true, ref: 'Doctor' },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    /** Denormalized lowercase name: lets case-insensitive prefix search and sort use an index. */
    nameLower: { type: String, required: true },
    dateOfBirth: { type: Date, required: true },
    gender: { type: String, required: true, enum: GENDERS },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: null },
    condition: { type: String, required: true, enum: PATIENT_CONDITIONS },
    diagnosis: { type: String, required: true, trim: true, maxlength: 500 },
    admittedAt: { type: Date, required: true },
  },
  { timestamps: true, versionKey: false, collection: 'patients' },
);

/*
 * Index strategy (ESR: Equality → Sort → Range). Default order is admittedAt desc.
 * - doctorId + admittedAt: a doctor's patient list, and per-doctor counts (prefix doctorId).
 * - condition + admittedAt / gender + admittedAt: the facet filters, sorted and date-ranged.
 * - admittedAt: the unfiltered list, date-range filters and time-series statistics.
 * - nameLower: anchored prefix search and name sorting.
 */
patientSchema.index({ doctorId: 1, admittedAt: -1 });
patientSchema.index({ condition: 1, admittedAt: -1 });
patientSchema.index({ gender: 1, admittedAt: -1 });
patientSchema.index({ admittedAt: -1 });
patientSchema.index({ nameLower: 1 });

export type PatientRecord = InferSchemaType<typeof patientSchema>;

export const PatientModel = model('Patient', patientSchema);
