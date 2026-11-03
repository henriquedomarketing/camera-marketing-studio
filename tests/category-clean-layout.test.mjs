import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../studio-redesign.css',import.meta.url),'utf8');
const start=app.indexOf('function clientCategories(){');
const end=app.indexOf('function cameraView(){',start);
assert.ok(start>0&&end>start,'Página inicial do cliente encontrada');
const page=app.slice(start,end);

test('Lista de categorias não tem mais quadradinhos ou ícones no início',()=>{
  assert.match(page,/class="client-category-item"/);
  assert.doesNotMatch(page,/client-category-symbol/);
  assert.doesNotMatch(page,/>▦</);
  assert.match(page,/class="client-category-name"/);
  assert.match(page,/class="client-category-count"/);
  assert.match(page,/class="client-category-arrow"/);
});

test('Contador de filtros usa singular e plural corretamente',()=>{
  assert.match(page,/count===1\?'filtro disponível':'filtros disponíveis'/);
  assert.match(page,/app\.filters\.filter\(f=>f\.category_id===c\.id&&f\.active\)\.length/);
});

test('Todas as categorias continuam clicáveis e abrem a câmera correta',()=>{
  assert.match(page,/data-act="open-category"/);
  assert.match(page,/data-id="\$\{escapeHtml\(c\.id\)\}"/);
  assert.match(app,/if\(act==='open-category'\)/);
});

test('Cards compactos têm bordas sutis e são adaptados ao mobile',()=>{
  assert.match(css,/\/\* Categorias sem o ícone quadrado:/);
  assert.match(css,/\.client-app\.is-home \.client-category-item \{\s*min-height:60px;/);
  assert.match(css,/border:1px solid #e9edf6 !important/);
  assert.match(css,/\.client-app\.is-home \.client-category-count/);
  assert.match(css,/@media\(max-width:430px\) \{\s*\.client-app\.is-home \.client-category-item/);
});
