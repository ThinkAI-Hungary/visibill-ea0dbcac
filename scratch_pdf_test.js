// Quick test: can pdf-lib load the problematic PDF?
import { PDFDocument } from 'pdf-lib';
import fs from 'fs';

const bytes = fs.readFileSync('d:/ThinkAI/Visibill/eaisybill-prod/scratch_test_68.pdf');
console.log(`File size: ${bytes.length} bytes`);
console.time('PDFDocument.load');
try {
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  console.timeEnd('PDFDocument.load');
  console.log(`Pages: ${pdf.getPageCount()}`);
  
  // Try to copy to another document
  console.time('copyPages');
  const dest = await PDFDocument.create();
  const pages = await dest.copyPages(pdf, pdf.getPageIndices());
  for (const page of pages) {
    dest.addPage(page);
  }
  console.timeEnd('copyPages');
  console.log('Copy successful!');
  
  // Try to save
  console.time('save');
  const savedBytes = await dest.save();
  console.timeEnd('save');
  console.log(`Saved: ${savedBytes.length} bytes`);
} catch (err) {
  console.timeEnd('PDFDocument.load');
  console.error('Failed:', err.message);
}
