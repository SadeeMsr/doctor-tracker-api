import type { Types } from 'mongoose';

import type {
  AnalyticsQuery,
  Bucket,
  DateWindow,
  DoctorCaseload,
  Interval,
  SpecializationStats,
} from '../../../../application/ports/analytics-query.js';
import type { Specialization } from '../../../../domain/doctor/doctor.entity.js';
import type { PatientCondition } from '../../../../domain/patient/patient.entity.js';
import { DoctorModel } from '../models/doctor.model.js';
import { PatientModel } from '../models/patient.model.js';

const inWindow = ({ from, to }: DateWindow) => ({ admittedAt: { $gte: from, $lte: to } });

/**
 * Dashboard aggregations. Every pipeline that filters starts with an indexed `$match`.
 * Methods return real promises (`.exec()`), not Mongoose queries: a query is a thenable that
 * re-executes each time it is awaited.
 */
export class MongoAnalyticsQuery implements AnalyticsQuery {
  /** Collection metadata, not a scan: O(1) regardless of size. */
  countDoctors(): Promise<number> {
    return DoctorModel.estimatedDocumentCount().exec();
  }

  countPatients(): Promise<number> {
    return PatientModel.estimatedDocumentCount().exec();
  }

  /** Counted from the admittedAt index range. */
  countAdmissions(window: DateWindow): Promise<number> {
    return PatientModel.countDocuments(inWindow(window)).exec();
  }

  async countByCondition() {
    const rows = await PatientModel.aggregate<{ _id: PatientCondition; count: number }>([
      { $group: { _id: '$condition', count: { $sum: 1 } } },
    ]);
    return rows.map((row) => ({ condition: row._id, count: row.count }));
  }

  async admissionsOverTime(window: DateWindow, interval: Interval): Promise<Bucket[]> {
    const rows = await PatientModel.aggregate<{ _id: Date; count: number }>([
      { $match: inWindow(window) },
      {
        $group: {
          // Same truncation as the service's zero-filling (UTC, weeks start Monday).
          _id: {
            $dateTrunc: {
              date: '$admittedAt',
              unit: interval,
              timezone: 'UTC',
              startOfWeek: 'monday',
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    return rows.map((row) => ({ periodStart: row._id, count: row.count }));
  }

  async topDoctorsByPatients(limit: number): Promise<DoctorCaseload[]> {
    const rows = await PatientModel.aggregate<{
      patients: number;
      doctor: { _id: Types.ObjectId; name: string; specialization: Specialization };
    }>([
      { $group: { _id: '$doctorId', patients: { $sum: 1 } } },
      { $sort: { patients: -1, _id: 1 } },
      // Limit first, join after: $lookup runs for 10 rows, not for every doctor.
      { $limit: limit },
      {
        $lookup: {
          from: 'doctors',
          localField: '_id',
          foreignField: '_id',
          as: 'doctor',
          pipeline: [{ $project: { name: 1, specialization: 1 } }],
        },
      },
      { $unwind: '$doctor' },
    ]);
    return rows.map(({ doctor, patients }) => ({
      doctor: {
        id: doctor._id.toHexString(),
        name: doctor.name,
        specialization: doctor.specialization,
      },
      patients,
    }));
  }

  async bySpecialization(): Promise<SpecializationStats[]> {
    const [doctorRows, patientRows] = await Promise.all([
      DoctorModel.aggregate<{ _id: Specialization; doctors: number }>([
        { $group: { _id: '$specialization', doctors: { $sum: 1 } } },
      ]),
      PatientModel.aggregate<{ _id: Specialization; patients: number }>([
        // Collapse to one row per doctor first, so the join runs once per doctor, not per patient.
        { $group: { _id: '$doctorId', patients: { $sum: 1 } } },
        {
          $lookup: {
            from: 'doctors',
            localField: '_id',
            foreignField: '_id',
            as: 'doctor',
            pipeline: [{ $project: { specialization: 1 } }],
          },
        },
        { $unwind: '$doctor' },
        { $group: { _id: '$doctor.specialization', patients: { $sum: '$patients' } } },
      ]),
    ]);

    const patientsBySpecialization = new Map(patientRows.map((row) => [row._id, row.patients]));
    return doctorRows
      .map((row) => ({
        specialization: row._id,
        doctors: row.doctors,
        patients: patientsBySpecialization.get(row._id) ?? 0,
      }))
      .sort((a, b) => b.patients - a.patients || a.specialization.localeCompare(b.specialization));
  }
}
