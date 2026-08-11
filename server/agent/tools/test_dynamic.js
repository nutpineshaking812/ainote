import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const builtinsDir = path.join(__dirname, 'builtins');

const files = fs.readdirSync(builtinsDir).filter(f => f.endsWith('.js'));
const tools = {};

for (const file of files) {
    const mod = await import(`./builtins/${file}`);
    for (const key of Object.keys(mod)) {
        const t = mod[key];
        if (t && t.name && typeof t.execute === 'function') {
            tools[t.name] = t;
        }
    }
}
console.log('Successfully loaded tools:', Object.keys(tools).length);
