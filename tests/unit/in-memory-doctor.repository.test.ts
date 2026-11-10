import { describeDoctorRepositoryContract } from '../contract/doctor-repository.contract.js';
import { InMemoryDoctorRepository } from '../support/in-memory-doctor.repository.js';

describeDoctorRepositoryContract('in-memory', () => new InMemoryDoctorRepository());
