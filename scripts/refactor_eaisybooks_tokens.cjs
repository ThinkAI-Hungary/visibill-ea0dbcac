const fs = require('fs');
const path = require('path');

const TARGET_DIRS = [
  path.join(__dirname, '..', 'src', 'pages', 'Accounty'),
  path.join(__dirname, '..', 'src', 'components', 'accounty')
];

function getAllFiles(dir, exts = ['.tsx', '.ts']) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllFiles(filePath, exts));
    } else {
      if (exts.includes(path.extname(filePath))) {
        results.push(filePath);
      }
    }
  }
  return results;
}

let totalReplacements = 0;
let filesModified = 0;

const REPLACEMENTS = [
  // Compound dark/light pairs missed in first pass
  { pattern: /\bbg-white\s+dark:bg-slate-700\b/g, replacement: 'bg-card dark:bg-muted' },
  { pattern: /\bbg-slate-300\s+dark:bg-slate-600\b/g, replacement: 'bg-muted-foreground/30' },
  { pattern: /\bstroke-slate-100\s+dark:stroke-slate-800\b/g, replacement: 'stroke-muted' },
  { pattern: /\bborder-slate-50\s+dark:border-border\b/g, replacement: 'border-border' },
  { pattern: /\bbg-slate-900\s+text-white\b/g, replacement: 'bg-popover text-popover-foreground' },

  // Dark state cleanups
  { pattern: /\bdark:hover:text-slate-200\b/g, replacement: 'dark:hover:text-foreground' },
  { pattern: /\bdark:hover:bg-slate-800\b/g, replacement: 'dark:hover:bg-muted/50' },
  { pattern: /\bdark:hover:bg-slate-700\b/g, replacement: 'dark:hover:bg-muted' },
  { pattern: /\bdark:hover:bg-slate-900\/10\b/g, replacement: 'dark:hover:bg-muted/30' },
  { pattern: /\bdark:hover:border-slate-700\b/g, replacement: 'dark:hover:border-border' },
  { pattern: /\bdark:bg-slate-700\b/g, replacement: 'dark:bg-muted' },

  // Background and border cleanups
  { pattern: /\bborder-slate-50\b/g, replacement: 'border-border/40' },
  { pattern: /\bborder-slate-500\/20\b/g, replacement: 'border-muted-foreground/20' },
  { pattern: /\bborder-slate-500\/15\b/g, replacement: 'border-muted-foreground/15' },
  { pattern: /\bborder-slate-400\b/g, replacement: 'border-muted-foreground/40' },
  { pattern: /\bbg-slate-500\/15\b/g, replacement: 'bg-muted-foreground/15' },
  { pattern: /\bbg-slate-500\/10\b/g, replacement: 'bg-muted-foreground/10' },
  { pattern: /\bhover:bg-slate-500\/20\b/g, replacement: 'hover:bg-muted-foreground/20' },
  { pattern: /\bbg-slate-900\/40\b/g, replacement: 'bg-background/80' },
  { pattern: /\bbg-slate-500\b/g, replacement: 'bg-muted-foreground' },
  { pattern: /\bbg-slate-400\b/g, replacement: 'bg-muted-foreground/40' },
  { pattern: /\bbg-slate-300\b/g, replacement: 'bg-muted-foreground/30' },
  { pattern: /\bfrom-slate-500\s+to-slate-600\b/g, replacement: 'from-muted-foreground/80 to-muted-foreground' },
  { pattern: /\bfrom-slate-600\s+to-slate-800\b/g, replacement: 'from-muted to-card' },

  // Clean double-replacement typos
  { pattern: /\bhover:bg-muted\/40\/50\b/g, replacement: 'hover:bg-muted/50' },

  // font-display removal
  { pattern: /\s*\bfont-display\b/g, replacement: '' }
];

for (const dir of TARGET_DIRS) {
  if (!fs.existsSync(dir)) continue;
  const files = getAllFiles(dir);
  for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    let fileChanged = false;
    let localReplacements = 0;

    for (const rule of REPLACEMENTS) {
      const matches = content.match(rule.pattern);
      if (matches) {
        localReplacements += matches.length;
        content = content.replace(rule.pattern, rule.replacement);
        fileChanged = true;
      }
    }

    if (fileChanged) {
      fs.writeFileSync(file, content, 'utf8');
      filesModified++;
      totalReplacements += localReplacements;
      console.log(`[MODIFIED] ${path.relative(process.cwd(), file)} (${localReplacements} changes)`);
    }
  }
}

console.log(`\nPASS 2 DONE: ${totalReplacements} replacements across ${filesModified} files.`);
