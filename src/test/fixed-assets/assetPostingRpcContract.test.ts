import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * TENY – szerződésteszt a tárgyi eszköz könyvelő RPC-k kliens ↔ adatbázis paraméterneveire.
 *
 * Háttér: a PostgREST a függvényeket a megnevezett paraméterek alapján azonosítja; ha a kliens
 * olyan kulcsot küld, amit a DB-függvény nem deklarál (vagy kötelező paramétert kihagy),
 * PGRST202 hibát kapunk. A (43ba18e0) RBAC refaktor után az aktiválási és a fejlesztési tartalék
 * poster hibás neveket küldött (p_asset_gl_account_id, p_gl414, p_gl413), és a meglévő tesztek
 * objectContaining-gal csak a nem érintett kulcsokat ellenőrizték.
 *
 * A teszt a legfrissebb migrációs fájlokból olvassa ki a deklarált paramétereket, és a kliens
 * forrásban lévő rpc() hívások kulcshalmazát veti össze velük.
 */

const ROOT = process.cwd();
const MIGRATIONS_DIR = resolve(ROOT, 'supabase/migrations');

interface RpcParam {
  name: string;
  required: boolean;
}

/** A függvény paraméterlistája a migrációkból – a később datált migráció felülírja a korábbit. */
function loadDeclaredSignatures(): Map<string, RpcParam[]> {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{14}_.*\.sql$/.test(f))
    .sort();

  const signatures = new Map<string, RpcParam[]>();
  const fnRegex = /CREATE OR REPLACE FUNCTION\s+(?:public\.)?(\w+)\s*\(([\s\S]*?)\)\s*RETURNS/gi;

  for (const file of files) {
    const sql = readFileSync(resolve(MIGRATIONS_DIR, file), 'utf8');
    let match: RegExpExecArray | null;
    while ((match = fnRegex.exec(sql)) !== null) {
      const [, fnName, argBlock] = match;
      const params: RpcParam[] = [];
      for (const rawArg of argBlock.split(/,\s*(?=p_\w+\s)/)) {
        const arg = rawArg.trim();
        const paramMatch = /^(p_\w+)\s+[\w[\]]+(\s+DEFAULT\s+[\s\S]+)?$/i.exec(arg);
        if (paramMatch) {
          params.push({ name: paramMatch[1], required: !paramMatch[2] });
        }
      }
      if (params.length > 0) signatures.set(fnName, params);
    }
  }
  return signatures;
}

/** Az `rpc('fnName', { ... })` hívás objektumkulcsai a forrásfájlban. */
function extractRpcKeys(sourceRelPath: string, fnName: string): string[] {
  const source = readFileSync(resolve(ROOT, sourceRelPath), 'utf8');
  const start = source.indexOf(`rpc('${fnName}', {`);
  expect(start, `${fnName} rpc hívás nem található itt: ${sourceRelPath}`).toBeGreaterThanOrEqual(0);

  let depth = 0;
  let begin = -1;
  let end = -1;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') {
      if (depth === 0) begin = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const block = source.slice(begin + 1, end);

  // Csak a legfelső szintű kulcsok (nem a beágyazott objektumok kulcsai)
  const keys: string[] = [];
  let nesting = 0;
  for (const line of block.split('\n')) {
    const keyMatch = /^\s*(p_\w+)\s*:/.exec(line);
    if (nesting === 0 && keyMatch) keys.push(keyMatch[1]);
    nesting += (line.match(/[{[]/g) || []).length - (line.match(/[}\]]/g) || []).length;
  }
  return keys;
}

const CALLS: Array<{ fn: string; source: string }> = [
  { fn: 'post_asset_activation_to_gl', source: 'src/lib/fixed-assets/assetActivationAutoPoster.ts' },
  { fn: 'remove_asset_activation_from_gl', source: 'src/lib/fixed-assets/assetActivationAutoPoster.ts' },
  { fn: 'post_depreciation_run_to_gl', source: 'src/lib/fixed-assets/depreciationPostingService.ts' },
  { fn: 'post_development_reserve_to_gl', source: 'src/lib/fixed-assets/developmentReserveAutoPoster.ts' },
  { fn: 'remove_development_reserve_from_gl', source: 'src/lib/fixed-assets/developmentReserveAutoPoster.ts' },
  { fn: 'reconcile_fixed_assets_with_gl', source: 'src/lib/fixed-assets/assetReconciliationService.ts' },
  { fn: 'request_asset_disposal', source: 'src/lib/fixed-assets/assetDisposalPostingService.ts' },
  { fn: 'reject_asset_disposal', source: 'src/lib/fixed-assets/assetDisposalPostingService.ts' },
  { fn: 'approve_asset_disposal', source: 'src/lib/fixed-assets/assetDisposalPostingService.ts' },
];

describe('TENY könyvelő RPC-k – kliens ↔ DB paraméter szerződés', () => {
  const signatures = loadDeclaredSignatures();

  it.each(CALLS)('$fn: a migrációban deklarált függvény létezik', ({ fn }) => {
    expect(signatures.has(fn), `${fn} nincs deklarálva a migrációkban`).toBe(true);
  });

  it.each(CALLS)('$fn: a kliens csak deklarált paraméternevet küld', ({ fn, source }) => {
    const declared = new Set((signatures.get(fn) ?? []).map((p) => p.name));
    const sent = extractRpcKeys(source, fn);
    expect(sent.length).toBeGreaterThan(0);
    const unknown = sent.filter((key) => !declared.has(key));
    expect(unknown, `${fn}: ismeretlen paraméter(ek) → PGRST202`).toEqual([]);
  });

  it.each(CALLS)('$fn: a kliens minden kötelező paramétert elküld', ({ fn, source }) => {
    const required = (signatures.get(fn) ?? []).filter((p) => p.required).map((p) => p.name);
    const sent = new Set(extractRpcKeys(source, fn));
    const missing = required.filter((name) => !sent.has(name));
    expect(missing, `${fn}: hiányzó kötelező paraméter(ek)`).toEqual([]);
  });

  it('az aktiválási RPC paramétere p_gl_account_id (nem p_asset_gl_account_id)', () => {
    const sent = extractRpcKeys('src/lib/fixed-assets/assetActivationAutoPoster.ts', 'post_asset_activation_to_gl');
    expect(sent).toContain('p_gl_account_id');
    expect(sent).not.toContain('p_asset_gl_account_id');
  });

  it('a fejlesztési tartalék RPC paraméterei p_gl_414_id / p_gl_413_id', () => {
    const sent = extractRpcKeys('src/lib/fixed-assets/developmentReserveAutoPoster.ts', 'post_development_reserve_to_gl');
    expect(sent).toEqual(expect.arrayContaining(['p_gl_414_id', 'p_gl_413_id']));
    expect(sent).not.toContain('p_gl414');
    expect(sent).not.toContain('p_gl413');
  });

  it('a migrációs szignatúra-olvasó a fixed_asset_id patch-et is látja (a függvények nem változtak paraméterben)', () => {
    const activation = signatures.get('post_asset_activation_to_gl') ?? [];
    expect(activation.map((p) => p.name)).toEqual([
      'p_company_id',
      'p_asset_id',
      'p_asset_name',
      'p_inventory_number',
      'p_acquisition_value',
      'p_activation_date',
      'p_gl_account_id',
      'p_cip_gl_account_id',
      'p_currency',
    ]);
    expect(activation.find((p) => p.name === 'p_currency')?.required).toBe(false);
  });
});
