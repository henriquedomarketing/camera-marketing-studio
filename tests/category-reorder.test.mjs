import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const appSource=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const migration=readFileSync(new URL('../supabase/migrations/20261103_008_category_drag_order.sql',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');

const extract=(start,end)=>{
  const i=appSource.indexOf(start),j=appSource.indexOf(end,i+start.length);
  assert.ok(i>=0&&j>i,'Trecho de código presente: '+start);
  return appSource.slice(i,j);
};
const app={
  companies:[{id:'c1',name:'Feirão Sicredi'},{id:'c2',name:'P4 Veículos'}],
  categories:[
    {id:'a',company_id:'c1',name:'ESTANDE',sort_order:2,created_at:'2026-11-03T10:00:00Z'},
    {id:'x',company_id:'c2',name:'OFERTAS',sort_order:0,created_at:'2026-11-03T10:00:00Z'},
    {id:'b',company_id:'c1',name:'VENDIDOS',sort_order:0,created_at:'2026-11-03T10:00:00Z'},
    {id:'c',company_id:'c1',name:'CONDIÇÕES',sort_order:1,created_at:'2026-11-03T10:00:00Z'}
  ],
  filters:[{id:'f1',category_id:'b'}],
  categoryOrderCompanyId:'c1',
  orderSaving:false
};
const esc=value=>String(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
const option=(value,label,selected)=>'<option value="'+esc(value)+'" '+(selected?'selected':'')+'>'+esc(label)+'</option>';
const action=(name,id,label,cssClass='')=>'<button class="'+cssClass+'" data-act="'+name+'" data-id="'+id+'">'+label+'</button>';
const companyName=id=>app.companies.find(c=>c.id===id)?.name||'?';
const helper=extract('function orderedCategoriesForCompany(', '\nfunction categoriesSection(){');
const order=new Function('app','return ('+helper.trim()+')')(app);
const pageBody=extract('function categoriesSection(){','\nasync function persistCategoryOrder(');
const page=new Function('app','escapeHtml','option','action','companyName','orderedCategoriesForCompany',
  'return ('+pageBody.trim()+')')(app,esc,option,action,companyName,order);

test('Ordenação respeita sort_order e nunca mistura categorias de outras empresas',()=>{
  assert.deepEqual(order('c1').map(c=>c.id),['b','c','a']);
  assert.deepEqual(order('c2').map(c=>c.id),['x']);
});

test('Painel permite escolher empresa e arrastar categorias para reordenar',()=>{
  const html=page();
  assert.match(html,/id="categoryOrderCompany"/);
  assert.match(html,/data-category-drag-handle/);
  assert.match(html,/data-act="category-move-up"/);
  assert.match(html,/data-act="category-move-down"/);
  assert.match(html,/data-category-id="b"/);
  assert.doesNotMatch(html,/data-category-id="x"/);
  assert.ok(html.indexOf('data-category-id="b"')<html.indexOf('data-category-id="c"'));
  assert.ok(html.indexOf('data-category-id="c"')<html.indexOf('data-category-id="a"'));
  assert.match(html,/aria-label="Subir VENDIDOS" title="Subir" disabled/);
  assert.match(html,/aria-label="Descer ESTANDE" title="Descer" disabled/);
});

test('Selecionar outra empresa mostra somente suas categorias',()=>{
  app.categoryOrderCompanyId='c2';
  const html=page();
  assert.match(html,/data-category-id="x"/);
  assert.doesNotMatch(html,/data-category-id="a"/);
  assert.doesNotMatch(html,/data-category-id="b"/);
  app.categoryOrderCompanyId='c1';
});

test('Arrastar com pointer events oferece suporte a mouse e toque',()=>{
  assert.match(appSource,/function categoryOrderPointerDown\(event\)/);
  assert.match(appSource,/function categoryOrderPointerMove\(event\)/);
  assert.match(appSource,/function categoryOrderPointerEnd\(event,cancel=false\)/);
  assert.match(appSource,/addEventListener\('pointerdown',categoryOrderPointerDown\)/);
  assert.match(appSource,/addEventListener\('pointermove',categoryOrderPointerMove/);
  assert.match(appSource,/addEventListener\('pointercancel'/);
  assert.match(css,/\.category-drag-handle/);
  assert.match(css,/touch-action:none/);
});

test('Ordem é gravada no Supabase como operação única e recuperada no carregamento',()=>{
  assert.match(appSource,/api\.rpc\('reorder_company_categories'/);
  assert.match(appSource,/p_company_id:companyId,p_category_ids:orderedIds/);
  assert.match(appSource,/await loadData\(\)/);
  assert.match(appSource,/\.order\('sort_order'\)\.order\('created_at'\)/);
  assert.match(appSource,/categoryOrderCompanyId/);
});

test('RPC recusa não administradores, IDs duplicados e categorias de outra empresa',()=>{
  assert.match(migration,/not private\.is_admin\(\)/);
  assert.match(migration,/count\(distinct id\)/);
  assert.match(migration,/owned_count <> category_count/);
  assert.match(migration,/category_count/);
  assert.match(migration,/revoke all on function public\.reorder_company_categories/);
  assert.match(migration,/grant execute on function public\.reorder_company_categories.*authenticated/);
  assert.doesNotMatch(migration,/\bdelete from public\.categories\b/i);
});

test('Categorias novas entram no fim e categorias antigas ganham posição inicial',()=>{
  assert.match(migration,/row_number\(\) over/);
  assert.match(migration,/create trigger categories_append_order/);
  assert.match(migration,/coalesce\(max\(sort_order\), -1\) \+ 1/);
});
