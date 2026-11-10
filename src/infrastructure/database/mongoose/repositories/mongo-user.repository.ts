import type { Types } from 'mongoose';

import type { NewUser, User } from '../../../../domain/user/user.entity.js';
import type { UserRepository } from '../../../../domain/user/user.repository.js';
import { UserModel, type UserRecord } from '../models/user.model.js';
import { isObjectId } from '../utils.js';

type LeanUser = UserRecord & { _id: Types.ObjectId; createdAt: Date; updatedAt: Date };

const PROJECTION = {
  email: 1,
  name: 1,
  role: 1,
  passwordHash: 1,
  createdAt: 1,
  updatedAt: 1,
} as const;

function toEntity(record: LeanUser): User {
  return {
    id: record._id.toHexString(),
    email: record.email,
    name: record.name,
    role: record.role,
    passwordHash: record.passwordHash,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export class MongoUserRepository implements UserRepository {
  async findById(id: string): Promise<User | null> {
    if (!isObjectId(id)) return null;
    const record = await UserModel.findById(id, PROJECTION).lean<LeanUser>();
    return record ? toEntity(record) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const record = await UserModel.findOne({ email }, PROJECTION).lean<LeanUser>();
    return record ? toEntity(record) : null;
  }

  async upsertByEmail(data: NewUser): Promise<User> {
    const record = await UserModel.findOneAndUpdate(
      { email: data.email },
      { $set: data },
      { upsert: true, returnDocument: 'after', runValidators: true, projection: PROJECTION },
    ).lean<LeanUser>();
    if (!record) throw new Error('Upsert returned no document');
    return toEntity(record);
  }
}
