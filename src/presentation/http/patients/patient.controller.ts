import type { z } from 'zod';

import type { PatientService } from '../../../application/patients/patient.service.js';
import { handle } from '../shared/handle.js';
import { toListResponse } from '../shared/pagination.js';
import { idParams } from '../shared/params.js';

import { presentPatient } from './patient.presenter.js';
import {
  createPatientBody,
  doctorPatientParams,
  listDoctorPatientsQuery,
  listPatientsQuery,
  updatePatientBody,
} from './patient.schemas.js';

interface FilterQuery {
  page: number;
  limit: number;
  from?: Date;
  to?: Date;
  condition?: z.output<typeof listPatientsQuery>['condition'];
}

/** Query-string names → use-case criteria (`condition` → `conditions`, dates → a range). */
function toCriteria<Q extends FilterQuery>({ page, limit, from, to, condition, ...rest }: Q) {
  return {
    criteria: { ...rest, conditions: condition, admittedAt: { from, to } },
    page: { page, limit },
  };
}

/** HTTP adapter for both the patients page and a doctor's patient list. */
export function createPatientController(patients: PatientService) {
  return {
    list: handle({ query: listPatientsQuery }, async (req, res) => {
      const { criteria, page } = toCriteria(req.query);
      res.json(toListResponse(await patients.list(criteria, page), presentPatient));
    }),

    getById: handle({ params: idParams }, async (req, res) => {
      res.json({ data: presentPatient(await patients.getById(req.params.id)) });
    }),

    update: handle({ params: idParams, body: updatePatientBody }, async (req, res) => {
      res.json({ data: presentPatient(await patients.update(req.params.id, req.body)) });
    }),

    remove: handle({ params: idParams }, async (req, res) => {
      await patients.delete(req.params.id);
      res.status(204).end();
    }),

    listForDoctor: handle(
      { params: idParams, query: listDoctorPatientsQuery },
      async (req, res) => {
        const { criteria, page } = toCriteria(req.query);
        const result = await patients.listForDoctor(req.params.id, criteria, page);
        res.json(toListResponse(result, presentPatient));
      },
    ),

    createForDoctor: handle({ params: idParams, body: createPatientBody }, async (req, res) => {
      const patient = await patients.createForDoctor(req.params.id, req.body);
      res
        .status(201)
        .location(`/api/v1/patients/${patient.id}`)
        .json({ data: presentPatient(patient) });
    }),

    removeFromDoctor: handle({ params: doctorPatientParams }, async (req, res) => {
      await patients.deleteForDoctor(req.params.id, req.params.patientId);
      res.status(204).end();
    }),
  };
}
