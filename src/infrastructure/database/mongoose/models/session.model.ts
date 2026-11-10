import { model, Schema, type InferSchemaType } from 'mongoose';

import { REVOCATION_REASONS } from '../../../../domain/session/session.entity.js';

const sessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    revokedReason: { type: String, enum: REVOCATION_REASONS, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false, collection: 'sessions' },
);

/*
 * - tokenHash unique: every refresh looks a session up by it.
 * - userId: "revoke all sessions of this user" on token reuse.
 * - expiresAt TTL (expireAfterSeconds 0): MongoDB deletes sessions once they expire.
 */
sessionSchema.index({ tokenHash: 1 }, { unique: true });
sessionSchema.index({ userId: 1 });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type SessionRecord = InferSchemaType<typeof sessionSchema>;

export const SessionModel = model('Session', sessionSchema);
