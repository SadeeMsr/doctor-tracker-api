import { DoctorService } from './application/doctors/doctor.service.js';
import { MongoDoctorRepository } from './infrastructure/database/mongoose/repositories/mongo-doctor.repository.js';

/**
 * Composition root: the only place that knows which concrete adapters back each port.
 * Swapping MongoDB for another database means changing the repositories created here.
 */
export function buildServices() {
  const doctorRepository = new MongoDoctorRepository();

  return {
    doctors: new DoctorService(doctorRepository),
  };
}

export type Services = ReturnType<typeof buildServices>;
