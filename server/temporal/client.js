import { Connection, Client } from '@temporalio/client';
import env from '../config/env.js';

let client = null;

export async function getTemporalClient() {
  if (client) return client;

  const connection = await Connection.connect({
    address: env.TEMPORAL_ADDRESS,
  });

  client = new Client({
    connection,
    namespace: env.TEMPORAL_NAMESPACE,
  });

  return client;
}
