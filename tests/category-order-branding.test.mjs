import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const storage=readFileSync(new URL('../supabase/migrations/20261103_009_fix_company_png_storage_rls.sql',import.meta.url),'utf8');
const reorder=readFileSync(new URL('../supabase/migrations/20261103_008_category_drag_order.sql',import.meta.url),'utf8');
const clientCss=readFileSync(new URL('../client.css',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');

test('O cliente pode ler somente os PNGs da propria empresa e ativos',()=>{
  assert.match(storage,/storage\.objects\.name like \(p\.company_id::text \|\| '\/%'\)/);
  assert.match(storage,/private\.is_admin\(\)/);
  assert.match(storage,/not c\.access_paused/);
  assert.match(storage,/c\.active/);
  assert.doesNotMatch(storage,/split_part\(c\.name/);
  assert.doesNotMatch(storage,/drop policy|delete from/i);
});

test('Logos sao mostradas sem texto de erro enquanto carregam',()=>{
  const hydrate=app.slice(app.indexOf('function hydrateBrandLogos(){'),app.indexOf('async function handleForm('));
  assert.match(hydrate,/brandLogoUrl\(company\)/);
  assert.match(hydrate,/brand-image-ready/);
  assert.match(hydrate,/className='client-logo-fallback'/);
  assert.doesNotMatch(hydrate,/Logo indisponível/);
  assert.match(clientCss,/img\[data-brand-logo\]\.brand-image-ready/);
});

test('O admin reorganiza categorias por arrastar e soltar ou setas',()=>{
  assert.match(app,/function categoryOrderPointerDown/);
  assert.match(app,/function categoryOrderPointerMove/);
  assert.match(app,/function categoryOrderPointerEnd/);
  assert.match(app,/setPointerCapture/);
  assert.match(app,/elementFromPoint/);
  assert.match(app,/data-act="category-move-up"/);
  assert.match(app,/data-act="category-move-down"/);
  assert.match(app,/data-category-drag-handle/);
  assert.match(app,/categoryOrderCompany/);
  assert.match(css,/\.category-drag-handle/);
  assert.match(css,/touch-action:none/);
});

test('A ordem fica salva pelo servidor apenas para a propria empresa',()=>{
  assert.match(app,/api\.rpc\('reorder_company_categories'/);
  assert.match(reorder,/if \(select auth\.uid\(\)\) is null or not private\.is_admin\(\)/);
  assert.match(reorder,/category_count/);
  assert.match(reorder,/distinct_count <> requested_count/);
  assert.match(reorder,/where c\.id = ordered\.id and c\.company_id = p_company_id/);
  assert.match(reorder,/categories_append_order/);
});

test('Categorias clientes aparecem na ordem sort_order',()=>{
  assert.match(app,/api\.from\('categories'\)\.select\('\*'\)\.eq\('company_id',profile\.company_id\)\.order\('sort_order'\)/);
  assert.match(app,/app\.categories\.map\(c=>/);
  const f=app.slice(app.indexOf('function orderedCategoriesForCompany('),app.indexOf('function categoriesSection(){'));
  const mk=new Function('app',f+';return orderedCategoriesForCompany;');
  const fake={categories:[
    {id:'a',company_id:'x',sort_order:2,created_at:'2026-11-03'},
    {id:'b',company_id:'x',sort_order:0,created_at:'2026-11-03'},
    {id:'c',company_id:'x',sort_order:1,created_at:'2026-11-03'},
    {id:'other',company_id:'y',sort_order:0,created_at:'2026-11-03'}
  ]};
  assert.deepEqual(mk(fake)('x').map(c=>c.id),['b','c','a']);
});
