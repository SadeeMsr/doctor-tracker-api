import { model, Schema, type InferSchemaType } from 'mongoose';

const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;

const idempotencyKeySchema = new Schema(
  {
    /** Scoped key: method + path + client key, so one key can't collide across endpoints. */
    key: { type: String, required: true },
    requestHash: { type: String, required: true },
    status: { type: String, required: true, enum: ['processing', 'completed'] },
    response: {
      type: new Schema(
        { statusCode: Number, body: Schema.Types.Mixed, location: String },
        { _id: false },
      ),
      default: undefined,
    },
    /** When the current claim started. Drives both the lock timeout and the TTL. */
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { versionKey: false, collection: 'idempotency_keys' },
);

/*
 * - key unique: makes `claim` an atomic insert (no check-then-insert race).
 * - createdAt TTL: MongoDB deletes records automatically after 24 hours.
 */
idempotencyKeySchema.index({ key: 1 }, { unique: true });
idempotencyKeySchema.index({ createdAt: 1 }, { expireAfterSeconds: IDEMPOTENCY_TTL_SECONDS });

export type IdempotencyKeyRecord = InferSchemaType<typeof idempotencyKeySchema>;

export const IdempotencyKeyModel = model('IdempotencyKey', idempotencyKeySchema);
