/** Parser probe. Prints the row count for every extracted table, or the first failure. */
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildDataset } from './lib/dataset.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

try {
  const ds = await buildDataset({
    mdPath: join(root, 'data', 'final.md'),
    topicsPath: join(root, 'data', 'striver-a2z-topics.json'),
  });
  const names = Object.keys(ds.tables).sort();
  let total = 0;
  for (const n of names) {
    const c = ds.tables[n].length;
    total += c;
    console.log(`${String(c).padStart(5)}  ${n}`);
  }
  console.log(`${String(total).padStart(5)}  TOTAL rows across ${names.length} tables`);
  console.log('\nCalendar sums:', JSON.stringify(ds.meta.calendarSums));
  console.log('Calendar kinds:', JSON.stringify(ds.meta.calendarCounts));
  console.log('DSA split:', JSON.stringify(ds.meta.dsaSplit));
  console.log(
    `Appendix G lines ${ds.meta.verificationLog.startLine} to ${ds.meta.verificationLog.endLine}, doc_sections rows inside that range: ` +
      ds.tables.doc_sections.filter(
        (s) =>
          s.start_line >= ds.meta.verificationLog.startLine &&
          s.start_line <= ds.meta.verificationLog.endLine
      ).length
  );
  console.log('\nPart 7 category sizes:');
  let resTotal = 0;
  for (const c of ds.tables.resource_categories) {
    const n = ds.tables.resources.filter((r) => r.category_no === c.no).length;
    resTotal += n;
    console.log(`  ${String(c.no).padStart(2, '0')} ${c.name.padEnd(44)} ${String(n).padStart(3)}`);
  }
  console.log(`  ${''.padEnd(47)} ${String(resTotal).padStart(3)} total`);
  console.log('\nAppendix E contract:');
  for (const c of ds.seedContract) {
    const actual = ds.tables[c.table]?.length;
    const mark = actual === undefined ? '?' : actual === c.expected ? 'ok' : 'MISMATCH';
    console.log(`  ${c.table.padEnd(24)} expect ${String(c.expected).padStart(4)}  actual ${String(actual ?? '-').padStart(4)}  ${mark}`);
  }
} catch (err) {
  console.error(`\n${err.name}: ${err.message}\n`);
  if (err.stack) console.error(err.stack.split('\n').slice(1, 6).join('\n'));
  process.exitCode = 1;
}
