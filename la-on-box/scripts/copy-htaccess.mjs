import { copyFile } from 'node:fs/promises';
await copyFile(new URL('../public/.htaccess', import.meta.url), new URL('../dist/.htaccess', import.meta.url));
