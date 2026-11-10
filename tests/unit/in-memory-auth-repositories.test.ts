import { describeSessionRepositoryContract } from '../contract/session-repository.contract.js';
import { describeUserRepositoryContract } from '../contract/user-repository.contract.js';
import { InMemorySessionRepository } from '../support/in-memory-session.repository.js';
import { InMemoryUserRepository } from '../support/in-memory-user.repository.js';

describeUserRepositoryContract('in-memory', () => new InMemoryUserRepository());
describeSessionRepositoryContract('in-memory', () => new InMemorySessionRepository());
