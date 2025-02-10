#!/usr/bin/env node

import { ActiveTable } from './active-table';

const stdin = process.stdin;
stdin.setEncoding('utf8');

let data = '';

stdin.on('data', (chunk) => {
  data += chunk;
});

stdin.on('end', async () => {
  try {
    const json = JSON.parse(data);
    const result = await new ActiveTable([{ data: json }]).handle();
    console.log(result);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
});
