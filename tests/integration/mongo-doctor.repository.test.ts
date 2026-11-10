import { MongoDoctorRepository } from '../../src/infrastructure/database/mongoose/repositories/mongo-doctor.repository.js';
import { describeDoctorRepositoryContract } from '../contract/doctor-repository.contract.js';
import { useMongoMemoryServer } from '../support/mongo.js';

useMongoMemoryServer();
describeDoctorRepositoryContract('mongodb', () => new MongoDoctorRepository());
