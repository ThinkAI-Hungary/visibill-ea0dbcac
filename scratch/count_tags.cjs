const ts = require('typescript');

const fileName = 'src/pages/Accounty/ClientDetailsPage.tsx';
const program = ts.createProgram([fileName], {
  jsx: ts.JsxEmit.ReactJSX,
  target: ts.ScriptTarget.ES2020,
  module: ts.ModuleKind.CommonJS,
  skipLibCheck: true,
});

const diagnostics = ts.getPreEmitDiagnostics(program);
let count = 0;

for (const diag of diagnostics) {
  if (diag.file && diag.file.fileName.includes('ClientDetailsPage')) {
    const { line, character } = diag.file.getLineAndCharacterOfPosition(diag.start);
    const message = ts.flattenDiagnosticMessageText(diag.messageText, '\n');
    console.log(`Diagnostic: ${diag.file.fileName}:${line + 1}:${character + 1} - ${message}`);
    count++;
  }
}

if (count === 0) {
  console.log('No TS compile errors in ClientDetailsPage.tsx!');
} else {
  console.log(`Found ${count} TS compile errors in ClientDetailsPage.tsx.`);
}
