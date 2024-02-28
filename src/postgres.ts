/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable import/no-mutable-exports */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Pool } from 'pg';
import assert from 'assert';
import { isEmpty, isPlainObject, omit } from 'lodash';

// TODO: consider using a SQL library like TypeORM, Knex, Sequelize, or Prisma

// TODO: should we use pg-native?
// https://node-postgres.com/features/native
// https://github.com/brianc/node-postgres/issues/1993

// Connection config, see: https://node-postgres.com/features/connecting
export const CONFIG = {
  database: process.env.DATABASE_NAME || 'node-rest-api',
  user: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
  max: 20, // TODO: find optimal number of clients in the pool - defaults to 10
};

// Connection pooling, see: https://node-postgres.com/features/pooling
export let pool: Pool | undefined;

function safeConfig(config: any): any {
  return omit(config, ['password']);
}

function isSafeKey(key: string): boolean {
  return Boolean(key && key.match(/^[a-zA-Z0-9_-]+$/));
}

// NOTE: seems there is an issue with jsonb columns for array values and we need to stringify them
function pgValue(value: any): any {
  return Array.isArray(value) ? JSON.stringify(value) : value;
}

// A deep version of lodash mapKeys
// Example:
// deepMapKeys({accountId: {view_id: 123}}, camelCase)
// => { accountId: { viewId: 123 } }
export function deepMapKeys(obj: any, mapper: any): any {
  if (Array.isArray(obj)) {
    return obj.map(val => deepMapKeys(val, mapper));
  }
  if (isPlainObject(obj)) {
    return Object.keys(obj).reduce((acc: any, key: string) => {
      const newKey = mapper(key);
      acc[newKey] = deepMapKeys(obj[key], mapper);
      return acc;
    }, {});
  }
  return obj;
}

export function snakeCase(name: string): string {
  return name && name.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

export function camelCase(name: string): string {
  return name && name.replace(/_([a-z])/g, g => g[1].toUpperCase());
}

function assertCanInvokeFunction(functionName: string, args: any[]): void {
  if (!pool) throw Error('Postgres connection not initialized');
  if (args.find(isEmpty)) {
    throw new Error(
      `Cannot invoke postgres ${functionName} function - args must be non-empty, args: ${JSON.stringify(
        args
      )}`
    );
  }
}

function assertSafeKeys(options: any): void {
  if (Array.isArray(options)) {
    options.forEach(assertSafeKeys);
  } else if (isPlainObject(options)) {
    Object.keys(options).forEach(key => {
      if (!isSafeKey(key)) {
        throw new Error(`Unsafe key in Postgres options: "${key}"`);
      }
      assertSafeKeys(options[key]);
    });
  }
}

function handleWhereOption(
  whereOption: any,
  sql: string[],
  values: any[]
): void {
  if (isEmpty(whereOption)) return;
  assertSafeKeys(whereOption);
  const where = deepMapKeys(whereOption, snakeCase);
  const whereColumns = Object.keys(where);
  const whereValues = whereColumns.map(c => where[c]);
  const whereClause = whereColumns
    .map((name, index) => `${name} = $${index + 1 + values.length}`)
    .join(' AND ');
  sql.push(`WHERE ${whereClause}`);
  values.push(...whereValues);
}

function handleOrderByOption(orderBy: any, sql: string[]): void {
  if (isEmpty(orderBy)) return;
  assertSafeKeys(orderBy);
  const orderClauses = Object.entries(orderBy).map(([fieldName, direction]) => {
    const columnName = snakeCase(fieldName);
    const pgDirection = direction === 'desc' ? 'desc' : 'asc';
    return `${columnName} ${pgDirection}`;
  });
  sql.push(`ORDER BY ${orderClauses.join(', ')}`);
}

export async function executeQuery(
  sql: string[],
  values: any[] = []
): Promise<any> {
  if (!pool) {
    throw Error('Cannot execute postgres query - connection not initialized');
  }
  const result = await pool.query(sql.join(' '), values);
  return result;
}

export function isEnabled() {
  return process.env.POSTGRES_ENABLED === 'true';
}

export async function assertConnectionWorks(c: Pool) {
  const res = await c.query('SELECT $1::text as message', ['connection works']);
  assert.strictEqual(
    res.rows[0].message,
    'connection works',
    'Postgres connection test query failed'
  );
}

export async function initConnection() {
  try {
    pool = new Pool(CONFIG);
    const startTime = Date.now();
    console.log('Connecting to postgres database', {
      config: safeConfig(CONFIG),
    });
    await pool.connect();
    await assertConnectionWorks(pool);
    const elapsed = Date.now() - startTime;
    console.log('Successfully connected to postgres database', { elapsed });
  } catch (err) {
    console.log('Error connecting to postgres database', {
      error: (err as any).stack || err,
      config: safeConfig(CONFIG),
    });
    throw err;
  }
}

export async function query(tableName: string, options: any = {}) {
  if (!pool) throw Error('Postgres connection not initialized');
  const select = options.select || 'SELECT *';
  const sql = [select, `FROM ${tableName}`];
  const values: any[] = [];
  handleWhereOption(options.where, sql, values);
  handleOrderByOption(options.orderBy, sql);
  const result = await executeQuery(sql, values);
  return result;
}

export async function exists(tableName: string, id: string): Promise<boolean> {
  const select = 'SELECT 1';
  const where = { id };
  const result = await query(tableName, { select, where });
  return result.rowCount > 0;
}

export async function update(tableName: string, id: string, doc: any) {
  assertCanInvokeFunction('update', [tableName, id, doc]);
  assertSafeKeys(Object.keys(doc));
  const sql = [`UPDATE ${tableName}`];
  const values: any[] = [];
  const setFields = Object.keys(doc);
  if (isEmpty(setFields)) return undefined;
  const setClauses = setFields.map((fieldName, index) => {
    const columnName = snakeCase(fieldName);
    return `${columnName} = $${index + 1}`;
  });
  const setValues = setFields.map(fieldName => {
    return Array.isArray(doc[fieldName])
      ? JSON.stringify(doc[fieldName])
      : doc[fieldName];
  });
  sql.push(`SET ${setClauses.join(', ')}`);
  values.push(...setValues);
  handleWhereOption({ id }, sql, values);
  const result = await executeQuery(sql, values);
  return result;
}

export async function insert(tableName: string, doc: any) {
  assertCanInvokeFunction('insert', [tableName, doc]);
  assertSafeKeys(Object.keys(doc));
  const sql = [`INSERT INTO ${tableName}`];
  const insertFields = Object.keys(doc);
  const insertColumns = insertFields.map(snakeCase);
  const insertPlaceholders = insertColumns.map((_, index) => `$${index + 1}`);
  sql.push(`(${insertColumns.join(', ')})`);
  sql.push(`VALUES (${insertPlaceholders.join(', ')})`);
  const values = insertFields.map(fieldName => pgValue(doc[fieldName]));
  const result = await executeQuery(sql, values);
  return result;
}

export async function remove(tableName: string, id: string) {
  assertCanInvokeFunction('remove', [tableName, id]);
  const sql = [`DELETE FROM ${tableName}`];
  const values: any[] = [];
  handleWhereOption({ id }, sql, values);
  const result = await executeQuery(sql, values);
  return result;
}

