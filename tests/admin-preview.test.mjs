import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const begin=source.indexOf('function testFilters(){');
const end=source.indexOf('function finance(){',begin);
assert.ok(begin>0&&end>begin,'Tela Testar filtros existe');
const body=source.slice(begin,end);
const escapeHtml=v=>String(v).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const option=(v,t,selected)=>'<option value="'+escapeHtml(v)+'" '+(selected?'selected':'')+'>'+escapeHtml(t)+'</option>';
const header=(_,title,sub)=>'<h1>'+title+'</h1><p>'+sub+'</p>';
const createTestPage=new Function('app','option','escapeHtml','header','return ('+body.trim()+')');

test('Filtra cliente, categoria e PNG sem misturar empresas',()=>{
  const app={
    companies:[{id:'c1',name:'P4 VEÍCULOS'},{id:'c2',name:'Shopcar'}],
    categories:[{id:'ct1',company_id:'c1',name:'Feirão'},{id:'ct2',company_id:'c2',name:'Ofertas'}],
    filters:[{id:'p4-filter',company_id:'c1',category_id:'ct1',active:true,name:'P4 feirão'},
      {id:'shop-filter',company_id:'c2',category_id:'ct2',active:true,name:'Shopcar ofertas'}],
    adminTest:{active:false,companyId:'c1',categoryId:'ct1'}
  };
  const html=createTestPage(app,option,escapeHtml,header)();
  assert.match(html,/P4 VEÍCULOS/);
  assert.match(html,/P4 feirão/);
  assert.doesNotMatch(html,/Shopcar ofertas/);
  assert.match(html,/data-act="start-admin-test"/);
  assert.match(html,/id="testCompanySelect"/);
  assert.match(html,/id="testCategorySelect"/);
  app.adminTest.companyId='c2';app.adminTest.categoryId=null;
  const html2=createTestPage(app,option,escapeHtml,header)();
  assert.match(html2,/Shopcar ofertas/);
  assert.doesNotMatch(html2,/P4 feirão/);
  assert.equal(app.adminTest.categoryId,'ct2');
});

test('Sem categoria não permite abrir câmera de testes',()=>{
  const app={companies:[{id:'c1',name:'Cliente sem filtros'}],categories:[],filters:[],
    adminTest:{active:false,companyId:null,categoryId:null}};
  const html=createTestPage(app,option,escapeHtml,header)();
  assert.match(html,/data-act="start-admin-test" disabled/);
});

test('Admin abre câmera e volta ao painel mantendo login',()=>{
  assert.match(source,/\['test-filters','◉ Testar filtros'\]/);
  assert.match(source,/app\.profile\?\.role!=='admin'/);
  assert.match(source,/app\.adminTest\.active=true;/);
  assert.match(source,/resetCameraSession\(ca\.id\)/);
  const m=source.match(/function exitAdminTest\(\)\{[\s\S]*?\n\}/)?.[0];
  assert.ok(m);
  assert.match(m,/stopCamera\(\)/);
  assert.match(m,/clearCapturedPhoto\(\)/);
  assert.match(m,/clearGalleryPhoto\(\)/);
  assert.match(m,/app\.adminTest\.active=false/);
  assert.match(m,/app\.page='test-filters'/);
  assert.doesNotMatch(m,/signOut/);
});

test('Modo teste reusa câmera, mas limita categorias à empresa',()=>{
  assert.match(source,/const testing=admin&&app\.adminTest\.active&&\['camera','preview'\]/);
  assert.match(source,/if\(!admin\|\|testing\)/);
  assert.match(source,/shownCategories=testing\?app\.categories\.filter\(c=>c\.company_id===app\.adminTest\.companyId\)/);
  assert.match(source,/app\.adminTest\.active&&next\.company_id!==app\.adminTest\.companyId/);
  assert.match(source,/app\.adminTest\.active&&f\.company_id!==app\.adminTest\.companyId/);
  assert.match(source,/if\(\(!admin\|\|testing\)&&app\.page==='camera'/);
  assert.match(source,/if\(!app\.galleryPhoto\)startCamera\(\)/);
  assert.match(source,/data-act="exit-admin-test"/);
});
