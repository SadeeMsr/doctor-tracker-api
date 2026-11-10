import { Types } from 'mongoose';

import type {
  NewSession,
  RevocationReason,
  Session,
} from '../../../../domain/session/session.entity.js';
import type { SessionRepository } from '../../../../domain/session/session.repository.js';
import { SessionModel, type SessionRecord } from '../models/session.model.js';

type LeanSession = SessionRecord & { _id: Types.ObjectId; createdAt: Date };

function toEntity(record: LeanSession): Session {
  return {
    id: record._id.toHexString(),
    userId: record.userId.toHexString(),
    tokenHash: record.tokenHash,
    expiresAt: record.expiresAt,
    revokedAt: record.revokedAt ?? null,
    revokedReason: record.revokedReason ?? null,
    createdAt: record.createdAt,
  };
}

export class MongoSessionRepository implements SessionRepository {
  async create(session: NewSession): Promise<Session> {
    const created = await SessionModel.create({
      ...session,
      userId: new Types.ObjectId(session.userId),
    });
    return toEntity(created.toObject());
  }

  async findByTokenHash(tokenHash: string): Promise<Session | null> {
    const record = await SessionModel.findOne({ tokenHash }).lean<LeanSession>();
    return record ? toEntity(record) : null;
  }

  async revokeIfActive(
    tokenHash: string,
    now: Date,
    reason: RevocationReason,
  ): Promise<Session | null> {
    // One conditional update: concurrent callers can't both match `revokedAt: null`.
    const record = await SessionModel.findOneAndUpdate(
      { tokenHash, revokedAt: null, expiresAt: { $gt: now } },
      { $set: { revokedAt: now, revokedReason: reason } },
      { returnDocument: 'after' },
    ).lean<LeanSession>();
    return record ? toEntity(record) : null;
  }

  async revokeAllForUser(userId: string, now: Date, reason: RevocationReason): Promise<void> {
    if (!Types.ObjectId.isValid(userId)) return;
    await SessionModel.updateMany(
      { userId: new Types.ObjectId(userId), revokedAt: null },
      { $set: { revokedAt: now, revokedReason: reason } },
    );
  }
}
