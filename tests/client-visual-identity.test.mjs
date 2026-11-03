import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../client.css',import.meta.url),'utf8');

const layout=app.slice(app.indexOf('function layout(content){'),app.indexOf('function table(',app.indexOf('function layout(content){')));
const camera=app.slice(app.indexOf('function cameraView(){'),app.indexOf('function previewView(){'));

test('A logo do cliente permanece centralizada, não no cabeçalho',()=>{
  assert.match(app,/brandImg\(app\.company,'client-company-logo'\)/);
  assert.doesNotMatch(layout,/brandImg\(app\.company,'client-brand-logo'\)/);
  assert.match(layout,/class="client-brand client-brand-without-icon"/);
  assert.match(layout,/escapeHtml\(app\.company\?\.name\|\|'Minha empresa'\)/);
});

test('Menu da câmera usa a identidade da empresa e respeita a prévia administrativa',()=>{
  assert.match(layout,/id="clientCameraDrawer" style="\$\{brandStyle\(testing\?testingCompany:app\.company\)\}"/);
  assert.match(css,/\.client-app\.is-camera \.client-camera-drawer\{\s*background:var\(--brand-primary,#001893\)/);
  assert.match(css,/color:var\(--brand-on-primary,#fff\)/);
  assert.match(css,/\.client-app\.is-camera \.client-camera-drawer-category\.selected\{\s*background:var\(--brand-accent,#fff\)/);
  assert.match(css,/color:var\(--brand-on-accent,#001893\)/);
  assert.match(app,/function brandStyle\(company\)/);
  assert.match(app,/function brandInk\(hex\)/);
});

test('A câmera usa o mesmo texto de créditos presente no rodapé',()=>{
  assert.match(camera,/studioCredits\('client-camera-credits'\)/);
  assert.doesNotMatch(camera,/Resultado em 1080|Fotografe ou escolha uma foto da galeria\. Resultado/);
  assert.match(app,/Desenvolvido por <strong>@henriquedomarketing<\/strong>/);
  assert.match(app,/Desde 2025 · Todos os direitos reservados\./);
  assert.match(css,/\.client-app\.is-camera \.studio-credits\.client-camera-credits/);
});

test('A visualização da câmera continua com menu, filtros e botões ativos',()=>{
  assert.match(layout,/data-act="open-client-menu"/);
  assert.match(layout,/data-act="choose-filter"/);
  assert.match(camera,/data-act="capture"/);
  assert.match(camera,/data-act="pick-gallery"/);
  assert.match(camera,/data-act="flip-camera"/);
  assert.match(layout,/studioCredits\('client-footer'\)/);
  assert.match(layout,/cameraMode\?'':studioCredits/);
});
