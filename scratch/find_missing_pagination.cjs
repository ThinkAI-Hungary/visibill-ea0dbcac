const fs = require('fs');
const path = require('path');

const accountyDir = path.resolve(__dirname, '../src/pages/Accounty');

const tablePatterns = [
  'components/ui/table',
  '<Table',
  '<table',
  'useReactTable',
  '<tr',
  '<td'
];

const paginationPatterns = [
  'pagination',
  'Pagination',
  'pageIndex',
  'pageSize',
  'currentPage',
  'setCurrentPage',
  'paginate',
  'pages',
  'PaginationContent',
  'PaginationItem',
  'totalPages'
];

function getFilesRecursively(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFilesRecursively(fullPath));
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(fullPath);
    }
  });
  return results;
}

function scan() {
  const files = getFilesRecursively(accountyDir);
  console.log(`Found ${files.length} tsx/ts files in Accounty directory.\n`);

  const missing = [];
  const hasPagination = [];
  const noTable = [];

  files.forEach(filePath => {
    const relativePath = path.relative(path.resolve(__dirname, '..'), filePath);
    const content = fs.readFileSync(filePath, 'utf8');

    const hasTable = tablePatterns.some(pat => content.includes(pat));
    if (!hasTable) {
      noTable.push(relativePath);
      return;
    }

    const hasPag = paginationPatterns.some(pat => content.includes(pat));
    if (hasPag) {
      hasPagination.push(relativePath);
    } else {
      missing.push(relativePath);
    }
  });

  console.log('=== FILES WITH TABLES MISSING PAGINATION ===');
  missing.forEach(file => console.log(`- [ ] ${file}`));
  console.log(`\nTotal missing: ${missing.length}`);

  console.log('\n=== FILES WITH TABLES THAT HAVE PAGINATION ===');
  hasPagination.forEach(file => console.log(`- [x] ${file}`));
  console.log(`\nTotal with pagination: ${hasPagination.length}`);
}

scan();
