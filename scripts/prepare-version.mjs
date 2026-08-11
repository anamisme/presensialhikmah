import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const sha = execSync('git rev-parse --short HEAD').toString().trim();
writeFileSync(
  'src/version.ts',
  `export const APP_VERSION = '${sha}';\n`,
);
console.log(`APP_VERSION = ${sha}`);
