import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../studio-glass.css',import.meta.url),'utf8');
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');

test('Camada de visual de referência é carregada depois do design oficial',()=>{
  assert.match(html,/href="\.\/studio-glass\.css"/);
  assert.ok(html.indexOf('./studio-glass.css')>html.indexOf('./studio-redesign.css'));
  assert.match(css,/Inspired by the supplied icy-blue login reference/i);
  assert.match(css,/--fs-aurora-blue:#001893/);
});

test('Fundo do login, dashboard e cliente é branco gelo com profundidade',()=>{
  assert.match(css,/\.auth-layout,\s*\.admin-layout\{/);
  assert.match(css,/\.auth-layout::before,\s*\.auth-layout::after/);
  assert.match(css,/\.client-app\.is-home\{/);
  assert.match(css,/\.client-app\.is-home::before,\s*\.client-app\.is-home::after/);
  assert.match(css,/\.client-app\.is-home \.client-content\{\s*background:transparent !important/);
});

test('Categorias seguem botão gradiente brilhante sem restaurar ícones quadrados',()=>{
  const category=css.slice(css.indexOf('/* Main feature: category cards'),css.indexOf('/* Smaller glass-blue secondary buttons'));
  assert.match(category,/\.client-app\.is-home \.client-category-item\{/);
  assert.match(category,/linear-gradient\(113deg,#3266e9/);
  assert.match(category,/border-radius:25px !important/);
  assert.match(category,/inset 0 2px rgba\(255,255,255/);
  assert.match(category,/\.client-category-name\{/);
  assert.match(category,/color:#fff !important/);
  assert.match(category,/\.client-category-count\{/);
  const screen=app.slice(app.indexOf('function clientCategories(){'),app.indexOf('function cameraView(){'));
  assert.doesNotMatch(screen,/client-category-symbol/);
  assert.match(screen,/data-act="open-category"/);
  assert.match(screen,/client-category-count/);
});

test('Botão menu e categorias do menu lateral têm o mesmo acabamento iOS',()=>{
  assert.match(css,/\.client-app\.is-camera \.client-camera-header \.client-camera-menu-toggle\{/);
  assert.match(css,/linear-gradient\(136deg,#3266e9/);
  assert.match(css,/\.client-app\.is-camera \.client-camera-drawer\{/);
  assert.match(css,/\.client-app\.is-camera \.client-camera-drawer-category,\s*\.client-app\.is-camera \.client-camera-drawer-bottom button/);
  assert.match(css,/linear-gradient\(115deg,#3266e9/);
  assert.match(css,/\.client-app\.is-camera \.client-camera-drawer-category\.selected\{/);
  assert.match(css,/\.client-camera-drawer :is\(button,a\):focus-visible/);
});

test('Câmera e filtros mantêm seus próprios handlers sem alteração',()=>{
  for(const action of ['open-client-menu','client-switch-category','open-category','capture','pick-gallery','flip-camera','finish-gallery']){
    assert.match(app,new RegExp("data-act=.*?"+action));
  }
  assert.match(app,/function cameraView\(\)/);
  assert.match(app,/function previewView\(\)/);
  assert.match(app,/async function saveFilterChanges\(form\)/);
  assert.match(app,/function categoryOrderPointerDown/);
  assert.match(css,/\.client-app\.is-camera \.client-photo-controls\{/);
});

function whiteContrast(hex){
  const value=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255)
    .map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
  const l=value[0]*.2126+value[1]*.7152+value[2]*.0722;
  return 1.05/(l+.05);
}
test('Degradês principais preservam contraste adequado com texto branco',()=>{
  for(const col of ['#3266e9','#2e62d9','#2357d5','#081b9c','#3a6bdd','#285cdb','#2e64fc','#245bec']){
    assert.ok(whiteContrast(col)>=4.5,col+' deve ter contraste mínimo 4,5:1');
  }
});
test('Visual responsivo e respeita preferência de reduzir movimento',()=>{
  assert.match(css,/@media\(max-width:430px\)/);
  assert.match(css,/@media\(max-width:360px\)/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
