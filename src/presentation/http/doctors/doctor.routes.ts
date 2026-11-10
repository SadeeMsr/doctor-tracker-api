import { Router } from 'express';

import type { DoctorService } from '../../../application/doctors/doctor.service.js';

import type { IdempotencyMiddleware } from '../middleware/idempotency.js';

import { createDoctorController } from './doctor.controller.js';

export function createDoctorRouter(
  doctors: DoctorService,
  idempotent: IdempotencyMiddleware,
): Router {
  const controller = createDoctorController(doctors);
  const router = Router();

  router.get('/', controller.list);
  // Optional key: the unique email already turns a retried create into a 409.
  router.post('/', idempotent({ required: false }), controller.create);
  // Static segments before `/:id` so they are not captured as an id.
  router.get('/hospitals', controller.listHospitals);
  router.get('/:id', controller.getById);
  router.patch('/:id', controller.update);
  router.delete('/:id', controller.remove);

  return router;
}
