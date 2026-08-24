#!/usr/bin/env node
/**
 * Exports every Level 2 waitlist signup from the WAITLIST_KV Workers KV
 * namespace to CSV (email,submittedAt,source,consentVersion), on stdout.
 *
 * Requires `wrangler` to be logged in to the Cloudflare account that owns
 * the namespace (`npx wrangler login`).
 *
 * Usage:
 *   node scripts/export-waitlist.mjs > waitlist.csv
 *   node scripts/export-waitlist.mjs --local > waitlist.csv   # local `wrangler dev` KV
 */
import { execFileSync } from 'node:child_process';

const remoteFlag = process.argv.includes('--local') ? [] : ['--remote'];

function wrangler(args) {
  return execFileSync('npx', ['wrangler', ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
}

function csvField(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const listOut = wrangler([
  'kv',
  'key',
  'list',
  '--binding=WAITLIST_KV',
  ...remoteFlag,
]);
const keys = JSON.parse(listOut)
  .map((row) => row.name)
  .filter((name) => name.startsWith('waitlist:'));

console.log('email,submittedAt,source,consentVersion');

for (const key of keys) {
  const valueOut = wrangler([
    'kv',
    'key',
    'get',
    key,
    '--binding=WAITLIST_KV',
    ...remoteFlag,
  ]);
  let record;
  try {
    record = JSON.parse(valueOut);
  } catch {
    console.error(`Skipping ${key}: could not parse value`);
    continue;
  }
  console.log(
    [record.email, record.submittedAt, record.source, record.consentVersion]
      .map(csvField)
      .join(','),
  );
}
