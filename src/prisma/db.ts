import 'dotenv/config';
import postgres from '@prisma/orm-postgres/runtime';
import type { Contract } from './contract.d';

// Use require for JSON in CommonJS mode
const contractJson = require('./contract.json');

export const db = postgres<Contract>({
  contractJson,
  url: process.env['DATABASE_URL']!,
});
