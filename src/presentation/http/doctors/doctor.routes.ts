import { Router } from 'express';

import type { DoctorService } from '../../../application/doctors/doctor.service.js';

import { createDoctorController } from './doctor.controller.js';

export function createDoctorRouter(doctors: DoctorService): Router {
  const controller = createDoctorController(doctors);
  const router = Router();

  router.get('/', controller.list);
  router.post('/', controller.create);
  // Static segments before `/:id` so they are not captured as an id.
  router.get('/hospitals', controller.listHospitals);
  router.get('/:id', controller.getById);
  router.patch('/:id', controller.update);
  router.delete('/:id', controller.remove);

  return router;
}
