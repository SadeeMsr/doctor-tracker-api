import { MongoBinary } from 'mongodb-memory-server';

/**
 * Runs once, before any test worker starts. Integration test files run in parallel and each
 * starts its own MongoMemoryServer; on a fresh machine (CI) they would all try to download the
 * MongoDB binary at the same time and race on its lock file. Downloading it here first means
 * every worker finds it already cached.
 */
export default async function setup(): Promise<void> {
  await MongoBinary.getPath();
}
