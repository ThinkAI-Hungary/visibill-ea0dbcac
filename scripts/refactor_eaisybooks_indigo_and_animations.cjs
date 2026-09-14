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
  // Page animations
  { pattern: /\banimate-in\s+fade-in\s+duration-500\b/g, replacement: 'page-animate' },
  { pattern: /\banimate-in\s+fade-in\s+duration-300\b/g, replacement: 'page-animate' },
  { pattern: /\banimate-in\s+fade-in\b/g, replacement: 'page-animate' },

  // Buttons and compound states
  { pattern: /\bbg-indigo-600\s+hover:bg-indigo-700\s+text-white\b/g, replacement: 'bg-primary hover:bg-primary/90 text-primary-foreground' },
  { pattern: /\bbg-indigo-600\s+text-white\s+hover:bg-indigo-700\b/g, replacement: 'bg-primary text-primary-foreground hover:bg-primary/90' },
  { pattern: /\btext-white\s+bg-indigo-600\s+hover:bg-indigo-700\b/g, replacement: 'text-primary-foreground bg-primary hover:bg-primary/90' },
  { pattern: /\bbg-indigo-600\s+hover:bg-indigo-700\b/g, replacement: 'bg-primary hover:bg-primary/90' },
  { pattern: /\bhover:bg-indigo-700\b/g, replacement: 'hover:bg-primary/90' },
  { pattern: /\bhover:text-indigo-600\b/g, replacement: 'hover:text-primary' },
  { pattern: /\bhover:text-indigo-700\b/g, replacement: 'hover:text-primary' },
  { pattern: /\bhover:text-indigo-500\b/g, replacement: 'hover:text-primary' },

  // Indigo bg/text pairs
  { pattern: /\bbg-indigo-50\s+dark:bg-indigo-900\/30\s+text-indigo-600\s+dark:text-indigo-400\b/g, replacement: 'bg-primary/10 text-primary' },
  { pattern: /\btext-indigo-600\s+dark:text-indigo-400\s+bg-indigo-50\s+dark:bg-indigo-900\/30\b/g, replacement: 'text-primary bg-primary/10' },
  { pattern: /\bbg-indigo-50\s+dark:bg-indigo-900\/30\b/g, replacement: 'bg-primary/10' },
  { pattern: /\bbg-indigo-50\s+dark:bg-indigo-900\/20\b/g, replacement: 'bg-primary/10' },
  { pattern: /\bbg-indigo-50\s+dark:bg-indigo-900\/40\b/g, replacement: 'bg-primary/10' },
  { pattern: /\bbg-indigo-50\s+dark:bg-indigo-900\/10\b/g, replacement: 'bg-primary/5' },
  { pattern: /\bbg-indigo-50\/50\s+dark:bg-indigo-950\/20\b/g, replacement: 'bg-primary/5' },

  // Standalone tokens
  { pattern: /\btext-indigo-600\b/g, replacement: 'text-primary' },
  { pattern: /\btext-indigo-500\b/g, replacement: 'text-primary' },
  { pattern: /\btext-indigo-400\b/g, replacement: 'text-primary' },
  { pattern: /\bbg-indigo-600\b/g, replacement: 'bg-primary' },
  { pattern: /\bbg-indigo-500\b/g, replacement: 'bg-primary' },
  { pattern: /\bbg-indigo-50\b/g, replacement: 'bg-primary/10' },
  { pattern: /\bborder-indigo-600\b/g, replacement: 'border-primary' },
  { pattern: /\bborder-indigo-500\b/g, replacement: 'border-primary' },
  { pattern: /\bborder-indigo-300\b/g, replacement: 'border-primary/40' },
  { pattern: /\bfocus:ring-indigo-500\b/g, replacement: 'focus:ring-primary' },
  { pattern: /\baccent-indigo-600\b/g, replacement: 'accent-primary' },
  { pattern: /\bshadow-indigo-500\/20\b/g, replacement: 'shadow-primary/20' },
  { pattern: /\bshadow-indigo-500\/25\b/g, replacement: 'shadow-primary/20' },
  { pattern: /\bfrom-indigo-600\b/g, replacement: 'from-primary' },
  { pattern: /\bto-indigo-600\b/g, replacement: 'to-primary' },
  { pattern: /\bto-indigo-700\b/g, replacement: 'to-primary/90' },
  { pattern: /\bring-indigo-300\b/g, replacement: 'ring-primary/40' },
];

for (const dir of TARGET_DIRS) {
  if (!fs.existsSync(dir)) continue;
  const files = getAllFiles(dir);
  for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;
    let countInFile = 0;

    for (const { pattern, replacement } of REPLACEMENTS) {
      const matches = content.match(pattern);
      if (matches) {
        countInFile += matches.length;
        content = content.replace(pattern, replacement);
      }
    }

    if (content !== original) {
      fs.writeFileSync(file, content, 'utf8');
      filesModified++;
      totalReplacements += countInFile;
      console.log(`Updated ${path.relative(path.join(__dirname, '..'), file)} (${countInFile} replacements)`);
    }
  }
}

console.log(`\n========================================`);
console.log(`Refactoring Complete!`);
console.log(`Total files modified: ${filesModified}`);
console.log(`Total replacements: ${totalReplacements}`);
console.log(`========================================\n`);
