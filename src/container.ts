import { DoctorService } from './application/doctors/doctor.service.js';
import { MongoDoctorRepository } from './infrastructure/database/mongoose/repositories/mongo-doctor.repository.js';
import { MongoIdempotencyStore } from './infrastructure/database/mongoose/repositories/mongo-idempotency-store.js';

/**
 * Composition root: the only place that knows which concrete adapters back each port.
 * Swapping MongoDB for another database means changing the adapters created here.
 */
export function buildContainer() {
  const doctorRepository = new MongoDoctorRepository();

  return {
    services: {
      doctors: new DoctorService(doctorRepository),
    },
    idempotencyStore: new MongoIdempotencyStore(),
  };
}

export type Container = ReturnType<typeof buildContainer>;
export type Services = Container['services'];
