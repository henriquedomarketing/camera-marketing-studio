import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const src=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../client.css',import.meta.url),'utf8');
const a=src.indexOf('async function validateCompanyLogo(file){');
const b=src.indexOf('async function uploadCompanyLogo(',a);
assert.ok(a>0&&b>a,'Validação de logo encontrada no aplicativo');
const code=src.slice(a,b).trim();
let revoked=0;
const urlMock={
  createObjectURL(file){return file;},
  revokeObjectURL(){revoked++;}
};
class ImageMock{
  naturalWidth=0;
  naturalHeight=0;
  set src(file){
    if(file.invalid){this.onerror?.();return;}
    this.naturalWidth=file.width;
    this.naturalHeight=file.height;
    this.onload?.();
  }
}
const validate=new Function('URL','Image','return ('+code+')')(urlMock,ImageMock);
const logo=(width,height,size=1200,type='image/png')=>({width,height,size,type});

test('Aceita PNG quadrado, horizontal e vertical sem obrigar 500 x 500',async()=>{
  for(const [w,h] of [[500,500],[1200,350],[350,1200],[1080,1920],[2400,1600],[150,150]]){
    await assert.doesNotReject(validate(logo(w,h)),`PNG ${w}x${h} deve ser aceito`);
  }
});

test('Rejeita formatos inválidos, arquivos acima de 2MB e PNG sem dimensões',async()=>{
  await assert.rejects(validate(logo(1000,400,1200,'image/jpeg')),/PNG de até 2 MB/);
  await assert.rejects(validate(logo(1000,400,3*1024*1024)),/PNG de até 2 MB/);
  await assert.rejects(validate(logo(0,500)),/vazia ou inválida/);
  await assert.rejects(validate({...logo(600,300),invalid:true}),/não é um PNG válido/);
  assert.ok(revoked>=1,'URLs temporárias são liberadas');
});

test('Formulário aceita PNG livre e a interface preserva proporção da logo',()=>{
  const form=src.slice(src.indexOf('function companyModal('),src.indexOf('function categoryModal('));
  assert.match(form,/qualquer tamanho e proporção/);
  assert.doesNotMatch(form,/500 × 500|500x500/);
  assert.match(css,/\.client-company-logo[^{}]*\{[^}]*object-fit:contain/);
  assert.match(css,/\.brand-form-logo-img[^{}]*\{[^}]*object-fit:contain/);
  assert.match(css,/\.company-admin-logo-img[^{}]*\{[^}]*object-fit:contain/);
});
