import { Router } from 'express';

import type { PatientService } from '../../../application/patients/patient.service.js';
import type { IdempotencyMiddleware } from '../middleware/idempotency.js';

import { createPatientController } from './patient.controller.js';

/** `/patients`: the dedicated patients page. */
export function createPatientRouter(patients: PatientService): Router {
  const controller = createPatientController(patients);
  const router = Router();

  router.get('/', controller.list);
  router.get('/:id', controller.getById);
  router.patch('/:id', controller.update);
  router.delete('/:id', controller.remove);

  return router;
}

/** `/doctors/:id/patients`: a doctor's patient list on the doctor detail page. */
export function createDoctorPatientsRouter(
  patients: PatientService,
  idempotent: IdempotencyMiddleware,
): Router {
  const controller = createPatientController(patients);
  // mergeParams: the doctor's `:id` comes from the mount path.
  const router = Router({ mergeParams: true });

  router.get('/', controller.listForDoctor);
  // Required key: patients have no natural unique field, so this is the only duplicate guard.
  router.post('/', idempotent({ required: true }), controller.createForDoctor);
  router.delete('/:patientId', controller.removeFromDoctor);

  return router;
}
