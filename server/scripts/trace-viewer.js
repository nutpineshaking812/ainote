import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TRACE_DIR = path.join(__dirname, '..', '..', 'logs', 'traces');

const colors = {
  PARENT: '\x1b[36m', // Cyan
  EXPERT: '\x1b[35m', // Magenta
  TOOL: '\x1b[33m',   // Yellow
  LLM: '\x1b[32m',    // Green
  SYSTEM: '\x1b[90m', // Gray
  RESET: '\x1b[0m',
  DIM: '\x1b[2m',
  BOLD: '\x1b[1m',
};

function colorize(line) {
  let colored = line;
  // Colorize Roles [ROLE   ]
  Object.keys(colors).forEach(role => {
    if (role === 'RESET' || role === 'DIM' || role === 'BOLD') return;
    const regex = new RegExp(`\\[${role.padEnd(7)}\\]`, 'g');
    colored = colored.replace(regex, `${colors.BOLD}${colors[role]}[${role.padEnd(7)}]${colors.RESET}`);
  });
  
  // Dim timestamps [HH:mm:ss]
  colored = colored.replace(/^\[(\d{2}:\d{2}:\d{2})\]/, `${colors.DIM}[$1]${colors.RESET}`);
  
  // Highlight Tools
  colored = colored.replace(/调用工具: (.+?) \(/, `调用工具: ${colors.BOLD}$1${colors.RESET} (`);
  colored = colored.replace(/工具结果 \[(.+?)\]:/, `工具结果 [${colors.BOLD}$1${colors.RESET}]:`);
  
  return colored;
}

function start() {
  if (!fs.existsSync(TRACE_DIR)) {
    console.error(`Trace directory not found: ${TRACE_DIR}`);
    return;
  }

  const files = fs.readdirSync(TRACE_DIR)
    .map(name => ({ name, time: fs.statSync(path.join(TRACE_DIR, name)).mtime.getTime() }))
    .sort((a, b) => b.time - a.time);

  if (files.length === 0) {
    console.log("No trace logs found yet. Waiting for executions...");
    setTimeout(start, 2000);
    return;
  }

  const latestFile = path.join(TRACE_DIR, files[0].name);
  console.log(`${colors.DIM}Watching latest trace: ${latestFile}${colors.RESET}\n`);

  let position = 0;
  // Initial Read
  const content = fs.readFileSync(latestFile, 'utf8');
  content.split('\n').forEach(line => {
    if (line) console.log(colorize(line));
  });
  position = fs.statSync(latestFile).size;

  // Watch for changes
  fs.watch(latestFile, (eventType) => {
    if (eventType === 'change') {
      const stats = fs.statSync(latestFile);
      const newSize = stats.size;
      if (newSize > position) {
        const stream = fs.createReadStream(latestFile, { start: position, end: newSize });
        stream.on('data', (chunk) => {
          chunk.toString().split('\n').filter(Boolean).forEach(line => {
            console.log(colorize(line));
          });
        });
        position = newSize;
      }
    }
  });
}

start();
