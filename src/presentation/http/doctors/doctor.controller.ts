import type { DoctorService } from '../../../application/doctors/doctor.service.js';
import { handle } from '../shared/handle.js';
import { toListResponse } from '../shared/pagination.js';
import { idParams } from '../shared/params.js';

import { presentDoctor } from './doctor.presenter.js';
import { createDoctorBody, listDoctorsQuery, updateDoctorBody } from './doctor.schemas.js';

/** HTTP adapter: translates requests into use-case calls and results into responses. */
export function createDoctorController(doctors: DoctorService) {
  return {
    list: handle({ query: listDoctorsQuery }, async (req, res) => {
      const { page, limit, from, to, ...criteria } = req.query;
      const result = await doctors.list({ ...criteria, createdAt: { from, to } }, { page, limit });
      res.json(toListResponse(result, presentDoctor));
    }),

    listHospitals: handle({}, async (_req, res) => {
      res.json({ data: await doctors.listHospitals() });
    }),

    getById: handle({ params: idParams }, async (req, res) => {
      res.json({ data: presentDoctor(await doctors.getById(req.params.id)) });
    }),

    create: handle({ body: createDoctorBody }, async (req, res) => {
      const doctor = await doctors.create(req.body);
      res
        .status(201)
        .location(`${req.baseUrl}/${doctor.id}`)
        .json({ data: presentDoctor(doctor) });
    }),

    update: handle({ params: idParams, body: updateDoctorBody }, async (req, res) => {
      res.json({ data: presentDoctor(await doctors.update(req.params.id, req.body)) });
    }),

    remove: handle({ params: idParams }, async (req, res) => {
      await doctors.delete(req.params.id);
      res.status(204).end();
    }),
  };
}
