import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const geometrySource = source.match(/function drawSourceCover\(ctx,source,width,height\)\{[\s\S]*?\n\}/);
assert.ok(geometrySource, 'A função real de enquadramento deve existir no app.js');
const drawSourceCover = new Function('return (' + geometrySource[0] + ')')();

function cropFor(width,height,kind='gallery'){
  let call;
  const context={drawImage(...args){call=args;}};
  const media=kind==='video'?{videoWidth:width,videoHeight:height}:{naturalWidth:width,naturalHeight:height};
  drawSourceCover(context,media,1080,1920);
  const [source,x,y,cropWidth,cropHeight,dx,dy,dw,dh]=call;
  assert.equal(source,media);
  assert.deepEqual([dx,dy,dw,dh],[0,0,1080,1920]);
  assert.ok(x>=-1e-7&&y>=-1e-7,'Sem bordas negativas');
  assert.ok(x+cropWidth<=width+1e-7&&y+cropHeight<=height+1e-7,'Recorte dentro da imagem');
  assert.ok(Math.abs(cropWidth/cropHeight-1080/1920)<1e-8,'Recorte 9:16 sem esticar');
  return {x,y,cropWidth,cropHeight};
}

test('Foto Stories 1080x1920 preservada integralmente',()=>{
  const c=cropFor(1080,1920);
  assert.equal(c.x,0);assert.equal(c.y,0);
  assert.equal(c.cropWidth,1080);assert.equal(c.cropHeight,1920);
});

test('Foto horizontal 4000x3000: cortar laterais igualmente, preservar altura',()=>{
  const c=cropFor(4000,3000);
  assert.equal(c.y,0);
  assert.equal(c.cropHeight,3000);
  assert.ok(Math.abs(c.x-(4000-c.cropWidth)/2)<1e-7);
});

test('Foto quadrada 2000x2000: centralizar sem distorcer',()=>{
  const c=cropFor(2000,2000);
  assert.equal(c.cropHeight,2000);
  assert.ok(Math.abs(c.x-437.5)<1e-7);
});

test('Foto vertical muito alta: cortar em cima e embaixo pelo centro',()=>{
  const c=cropFor(1080,2400);
  assert.equal(c.x,0);assert.equal(c.y,240);
  assert.equal(c.cropWidth,1080);assert.equal(c.cropHeight,1920);
});

test('Foto vertical 3:4: recortar laterais proporcionalmente',()=>{
  const c=cropFor(3000,4000);
  assert.equal(c.y,0);assert.equal(c.cropHeight,4000);
  assert.equal(c.x,375);
});

test('Câmera horizontal usa mesmo recorte central de 9:16',()=>{
  const c=cropFor(1920,1080,'video');
  assert.equal(c.y,0);assert.equal(c.cropHeight,1080);
  assert.ok(c.cropWidth<1920);
});

test('A página oferece foto da galeria e mantém troca de filtros',()=>{
  assert.match(source,/data-act="pick-gallery"/);
  assert.match(source,/data-act="choose-filter"/);
  assert.match(source,/async function loadGalleryPhoto\(/);
  assert.match(source,/const source=gallery\?gallery\.img:video/);
  assert.match(source,/ctx\.drawImage\(overlay,0,0,1080,1920\)/);
});

test('A tela de resultado usa Voltar em vez de Sair',()=>{
  const begin=source.indexOf('function layout(content)');
  const end=source.indexOf('function table(',begin);
  const layout=source.slice(begin,end);
  assert.match(layout,/type==='is-preview'\?[`]<header class="client-preview-header">/);
  assert.match(layout,/data-act="photo-back"/);
  assert.match(source,/if\(act==='photo-back'\)\{backToCamera\(true\);return;\}/);
  assert.match(source,/function backToCamera\(keepGallery=false\)/);
});
