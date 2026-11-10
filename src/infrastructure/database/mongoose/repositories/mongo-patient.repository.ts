import { Types, type PipelineStage, type QueryFilter } from 'mongoose';

import type { Specialization } from '../../../../domain/doctor/doctor.entity.js';
import type {
  NewPatient,
  Patient,
  PatientChanges,
  PatientWithDoctor,
} from '../../../../domain/patient/patient.entity.js';
import type {
  PatientListCriteria,
  PatientRepository,
} from '../../../../domain/patient/patient.repository.js';
import type { Page, PageRequest } from '../../../../domain/shared/pagination.js';
import { PatientModel, type PatientRecord } from '../models/patient.model.js';
import { isObjectId, prefixRegex } from '../utils.js';

type LeanPatient = PatientRecord & { _id: Types.ObjectId; createdAt: Date; updatedAt: Date };
type LeanPatientWithDoctor = LeanPatient & {
  doctor?: { _id: Types.ObjectId; name: string; specialization: Specialization };
};

/** Fields read for every query: never fetch more than the entity needs. */
const PROJECTION = {
  doctorId: 1,
  name: 1,
  dateOfBirth: 1,
  gender: 1,
  phone: 1,
  email: 1,
  condition: 1,
  diagnosis: 1,
  admittedAt: 1,
  createdAt: 1,
  updatedAt: 1,
} as const;

/**
 * Join the doctor's name. Placed after $skip/$limit, so it runs for the page only, not for
 * every matching patient.
 */
const WITH_DOCTOR: PipelineStage[] = [
  {
    $lookup: {
      from: 'doctors',
      localField: 'doctorId',
      foreignField: '_id',
      as: 'doctor',
      pipeline: [{ $project: { name: 1, specialization: 1 } }],
    },
  },
  { $unwind: { path: '$doctor', preserveNullAndEmptyArrays: true } },
  { $project: { ...PROJECTION, doctor: 1 } },
];

function toEntity(record: LeanPatient): Patient {
  return {
    id: record._id.toHexString(),
    doctorId: record.doctorId.toHexString(),
    name: record.name,
    dateOfBirth: record.dateOfBirth,
    gender: record.gender,
    phone: record.phone,
    email: record.email ?? null,
    condition: record.condition,
    diagnosis: record.diagnosis,
    admittedAt: record.admittedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function toEntityWithDoctor(record: LeanPatientWithDoctor): PatientWithDoctor {
  const { doctor } = record;
  return {
    ...toEntity(record),
    doctor: doctor
      ? { id: doctor._id.toHexString(), name: doctor.name, specialization: doctor.specialization }
      : null,
  };
}

function toPersistence(changes: PatientChanges) {
  const { doctorId, ...rest } = changes;
  return {
    ...rest,
    ...(doctorId !== undefined && { doctorId: new Types.ObjectId(doctorId) }),
    ...(changes.name !== undefined && { nameLower: changes.name.toLowerCase() }),
  };
}

/** Aggregation stages aren't cast by Mongoose, so ids must already be ObjectIds here. */
function buildFilter(criteria: PatientListCriteria): QueryFilter<PatientRecord> {
  const filter: QueryFilter<PatientRecord> = {};
  if (criteria.search) filter.nameLower = prefixRegex(criteria.search);
  if (criteria.doctorId) filter.doctorId = new Types.ObjectId(criteria.doctorId);
  if (criteria.conditions?.length) filter.condition = { $in: criteria.conditions };
  if (criteria.gender) filter.gender = criteria.gender;
  if (criteria.admittedAt?.from || criteria.admittedAt?.to) {
    filter.admittedAt = {
      ...(criteria.admittedAt.from && { $gte: criteria.admittedAt.from }),
      ...(criteria.admittedAt.to && { $lte: criteria.admittedAt.to }),
    };
  }
  return filter;
}

const SORT_FIELDS = {
  admittedAt: 'admittedAt',
  name: 'nameLower',
  createdAt: 'createdAt',
} as const;

export class MongoPatientRepository implements PatientRepository {
  async create(data: NewPatient): Promise<Patient> {
    const created = await PatientModel.create(toPersistence(data));
    return toEntity(created.toObject());
  }

  async findById(id: string): Promise<PatientWithDoctor | null> {
    if (!isObjectId(id)) return null;
    const [record] = await PatientModel.aggregate<LeanPatientWithDoctor>([
      { $match: { _id: new Types.ObjectId(id) } },
      ...WITH_DOCTOR,
    ]);
    return record ? toEntityWithDoctor(record) : null;
  }

  async list(
    criteria: PatientListCriteria,
    { page, limit }: PageRequest,
  ): Promise<Page<PatientWithDoctor>> {
    if (criteria.doctorId && !isObjectId(criteria.doctorId)) {
      return { items: [], total: 0, page, limit };
    }
    const filter = buildFilter(criteria);
    const direction = criteria.sortOrder === 'asc' ? 1 : -1;

    // The page query and the count run concurrently; `_id` keeps the order stable across pages.
    const [records, total] = await Promise.all([
      PatientModel.aggregate<LeanPatientWithDoctor>([
        { $match: filter },
        { $sort: { [SORT_FIELDS[criteria.sortBy]]: direction, _id: direction } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
        ...WITH_DOCTOR,
      ]),
      PatientModel.countDocuments(filter),
    ]);

    return { items: records.map(toEntityWithDoctor), total, page, limit };
  }

  async update(id: string, changes: PatientChanges): Promise<Patient | null> {
    if (!isObjectId(id)) return null;
    const record = await PatientModel.findByIdAndUpdate(id, toPersistence(changes), {
      returnDocument: 'after',
      runValidators: true,
      projection: PROJECTION,
    }).lean<LeanPatient>();
    return record ? toEntity(record) : null;
  }

  async delete(id: string): Promise<boolean> {
    if (!isObjectId(id)) return false;
    return (await PatientModel.deleteOne({ _id: id })).deletedCount === 1;
  }

  async deleteForDoctor(doctorId: string, patientId: string): Promise<boolean> {
    if (!isObjectId(doctorId) || !isObjectId(patientId)) return false;
    const result = await PatientModel.deleteOne({ _id: patientId, doctorId });
    return result.deletedCount === 1;
  }

  async countByDoctorIds(doctorIds: string[]): Promise<Map<string, number>> {
    const ids = doctorIds.filter(isObjectId).map((id) => new Types.ObjectId(id));
    if (ids.length === 0) return new Map();

    // Answered from the { doctorId, admittedAt } index prefix.
    const rows = await PatientModel.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { doctorId: { $in: ids } } },
      { $group: { _id: '$doctorId', count: { $sum: 1 } } },
    ]);
    return new Map(rows.map((row) => [row._id.toHexString(), row.count]));
  }
}
