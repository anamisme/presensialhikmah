import { execSync } from 'node:child_process';
import { createWriteStream, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ZipArchive } from 'archiver';

const sha = execSync('git rev-parse --short HEAD').toString().trim();
const distDir = 'dist';
const updateDir = join(distDir, 'update');
mkdirSync(updateDir, { recursive: true });

const zipPath = join(updateDir, 'dist.zip');
const output = createWriteStream(zipPath);
const archive = new ZipArchive({ zlib: { level: 9 } });
archive.pipe(output);

function addDir(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'update' || entry === '.DS_Store') continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      archive.directory(full, entry);
    } else {
      archive.file(full, { name: entry });
    }
  }
}

addDir(distDir);
await archive.finalize();
await new Promise((resolve) => output.on('close', resolve));

const versionJson = JSON.stringify(
  {
    version: sha,
    url: 'https://presensi.yayasanbaitulhikmah.com/update/dist.zip',
  },
  null,
  2,
);
createWriteStream(join(updateDir, 'version.json')).write(versionJson);

console.log(`Update bundle: dist/update/dist.zip (${sha})`);
