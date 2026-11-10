import type { NewDoctor } from '../../src/domain/doctor/doctor.entity.js';

let counter = 0;

export function aDoctor(overrides: Partial<NewDoctor> = {}): NewDoctor {
  counter += 1;
  return {
    name: `Dr. Test ${String(counter)}`,
    specialization: 'Cardiology',
    hospital: 'City General Hospital',
    phone: '+8801700000000',
    email: `doctor${String(counter)}@example.com`,
    ...overrides,
  };
}
