import { model, Schema, type InferSchemaType } from 'mongoose';

import { ROLES } from '../../../../domain/user/user.entity.js';

const userSchema = new Schema(
  {
    email: { type: String, required: true, trim: true, lowercase: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    role: { type: String, required: true, enum: ROLES },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true, versionKey: false, collection: 'users' },
);

/* email unique: login lookup, and identity for idempotent account provisioning. */
userSchema.index({ email: 1 }, { unique: true });

export type UserRecord = InferSchemaType<typeof userSchema>;

export const UserModel = model('User', userSchema);
