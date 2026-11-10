import type { QueryFilter, Types } from 'mongoose';

import type { Doctor, DoctorChanges, NewDoctor } from '../../../../domain/doctor/doctor.entity.js';
import type {
  DoctorListCriteria,
  DoctorRepository,
} from '../../../../domain/doctor/doctor.repository.js';
import { ConflictError } from '../../../../domain/shared/errors.js';
import type { Page, PageRequest } from '../../../../domain/shared/pagination.js';
import { DoctorModel, type DoctorRecord } from '../models/doctor.model.js';
import { isDuplicateKeyError, isObjectId, prefixRegex } from '../utils.js';

type LeanDoctor = DoctorRecord & { _id: Types.ObjectId };

/** Fields read for every query: never fetch more than the entity needs. */
const PROJECTION = {
  name: 1,
  specialization: 1,
  hospital: 1,
  phone: 1,
  email: 1,
  createdAt: 1,
  updatedAt: 1,
} as const;

function toEntity(record: LeanDoctor): Doctor {
  return {
    id: record._id.toHexString(),
    name: record.name,
    specialization: record.specialization,
    hospital: record.hospital,
    phone: record.phone,
    email: record.email,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function toPersistence(changes: DoctorChanges): Partial<DoctorRecord> {
  return {
    ...changes,
    ...(changes.name !== undefined && { nameLower: changes.name.toLowerCase() }),
  };
}

function translateWriteError(error: unknown): never {
  if (isDuplicateKeyError(error)) {
    throw new ConflictError('A doctor with this email already exists', { fields: ['email'] });
  }
  throw error;
}

export class MongoDoctorRepository implements DoctorRepository {
  async create(data: NewDoctor): Promise<Doctor> {
    try {
      const created = await DoctorModel.create(toPersistence(data));
      return toEntity(created.toObject());
    } catch (error) {
      return translateWriteError(error);
    }
  }

  async findById(id: string): Promise<Doctor | null> {
    if (!isObjectId(id)) return null;
    const record = await DoctorModel.findById(id, PROJECTION).lean<LeanDoctor>();
    return record ? toEntity(record) : null;
  }

  async list(criteria: DoctorListCriteria, { page, limit }: PageRequest): Promise<Page<Doctor>> {
    const filter: QueryFilter<DoctorRecord> = {};

    if (criteria.search) {
      const pattern = prefixRegex(criteria.search);
      filter.$or = [{ nameLower: pattern }, { email: pattern }];
    }
    if (criteria.specialization) filter.specialization = criteria.specialization;
    if (criteria.hospital) filter.hospital = criteria.hospital;
    if (criteria.createdAt?.from || criteria.createdAt?.to) {
      filter.createdAt = {
        ...(criteria.createdAt.from && { $gte: criteria.createdAt.from }),
        ...(criteria.createdAt.to && { $lte: criteria.createdAt.to }),
      };
    }

    const direction = criteria.sortOrder === 'asc' ? 1 : -1;
    const sortField = criteria.sortBy === 'name' ? 'nameLower' : 'createdAt';

    // Run the page query and the count concurrently. `_id` tie-breaker keeps pages stable.
    const [records, total] = await Promise.all([
      DoctorModel.find(filter, PROJECTION)
        .sort({ [sortField]: direction, _id: direction })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<LeanDoctor[]>(),
      DoctorModel.countDocuments(filter),
    ]);

    return { items: records.map(toEntity), total, page, limit };
  }

  async update(id: string, changes: DoctorChanges): Promise<Doctor | null> {
    if (!isObjectId(id)) return null;
    try {
      const record = await DoctorModel.findByIdAndUpdate(id, toPersistence(changes), {
        returnDocument: 'after',
        runValidators: true,
        projection: PROJECTION,
      }).lean<LeanDoctor>();
      return record ? toEntity(record) : null;
    } catch (error) {
      return translateWriteError(error);
    }
  }

  async delete(id: string): Promise<boolean> {
    if (!isObjectId(id)) return false;
    const result = await DoctorModel.deleteOne({ _id: id });
    return result.deletedCount === 1;
  }

  async listHospitals(): Promise<string[]> {
    const hospitals = await DoctorModel.distinct('hospital');
    return hospitals.sort((a, b) => a.localeCompare(b));
  }
}
