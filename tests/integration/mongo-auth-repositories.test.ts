import { MongoSessionRepository } from '../../src/infrastructure/database/mongoose/repositories/mongo-session.repository.js';
import { MongoUserRepository } from '../../src/infrastructure/database/mongoose/repositories/mongo-user.repository.js';
import { describeSessionRepositoryContract } from '../contract/session-repository.contract.js';
import { describeUserRepositoryContract } from '../contract/user-repository.contract.js';
import { useMongoMemoryServer } from '../support/mongo.js';

useMongoMemoryServer();
describeUserRepositoryContract('mongodb', () => new MongoUserRepository());
describeSessionRepositoryContract('mongodb', () => new MongoSessionRepository());
