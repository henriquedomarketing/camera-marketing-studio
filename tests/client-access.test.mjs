import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const appSource=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const dbSource=readFileSync(new URL('../supabase/migrations/20261102_005_pause_client_access.sql',import.meta.url),'utf8');
function extract(name){
  const start=appSource.indexOf('function '+name+'(');
  assert.ok(start>=0,'Função '+name+' presente');
  const next=appSource.indexOf('\n}',start);
  assert.ok(next>start,'Fechamento da função '+name);
  return appSource.slice(start,next+2);
}
const escapeHtml=value=>String(value).replace(/[&<>"']/g,char=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
})[char]);
function contactFor(phone){
  const app={settings:{branding:{supportWhatsapp:phone}}};
  const fn=new Function('app','escapeHtml','return ('+extract('supportContactMarkup')+')')(app,escapeHtml);
  return fn();
}

test('WhatsApp é obtido dinamicamente das configurações e formatado para o Brasil',()=>{
  const html=contactFor('(44) 99999-9999');
  assert.match(html,/WhatsApp do suporte/);
  assert.match(html,/\(44\) 99999-9999/);
  assert.match(html,/https:\/\/wa.me\/5544999999999\?text=/);
  assert.match(html,/Falar com suporte pelo WhatsApp/);
});

test('Número internacional +55 não recebe DDI duplicado',()=>{
  const html=contactFor('+55 (44) 99999-9999');
  assert.match(html,/https:\/\/wa.me\/5544999999999\?text=/);
  assert.doesNotMatch(html,/555544999999999/);
});

test('Sem número configurado oferece aviso sem inventar telefone ou link',()=>{
  const html=contactFor('');
  assert.match(html,/ainda não foi informado/);
  assert.doesNotMatch(html,/https:\/\/wa.me/);
});

test('Contato de suporte é escapado para impedir HTML arbitrário',()=>{
  const html=contactFor('<script>alert(1)</script>');
  assert.doesNotMatch(html,/<script>/);
  assert.match(html,/&lt;script&gt;/);
});

test('Cliente pausado vê tela de suporte e opção de revalidar acesso',()=>{
  const contact=contactFor('(44) 99999-9999');
  const view=new Function('supportContactMarkup','studioCredits',
    'return ('+extract('pausedClientView')+')')(
      ()=>contact,()=>'FOOTER');
  const html=view();
  assert.match(html,/Acesso temporariamente pausado/);
  assert.match(html,/check-client-access/);
  assert.match(html,/Falar com suporte pelo WhatsApp/);
  assert.match(html,/Sair da conta/);
});

test('Login identifica acesso pausado antes de renderizar câmera',()=>{
  const r=appSource.slice(appSource.indexOf('function render(){'),appSource.indexOf('async function loadData()'));
  assert.match(r,/app\.company\?\.access_paused/);
  assert.match(r,/stopCamera\(\);clearCapturedPhoto\(\);clearGalleryPhoto\(\)/);
  assert.ok(r.indexOf("pausedClientView()")<r.indexOf("const admin=app.profile.role==='admin'"));
  assert.match(appSource,/app\.settings=\{branding:settings\.data\?\.value\|\|\{\}\}/);
  assert.match(appSource,/if\(co\.data\?\.active&&!co\.data\?\.access_paused\)/);
  assert.match(appSource,/act==='check-client-access'/);
});

test('Pausar e reativar modifica apenas flag da empresa',()=>{
  assert.match(appSource,/data-act="toggle-client-access"|action\('toggle-client-access'/);
  assert.match(appSource,/update\(\{access_paused:pause\}\)/);
  assert.match(appSource,/c\.access_paused\?'Reativar acesso':'Pausar acesso'/);
  assert.match(appSource,/c\.access_paused\?'paused'/);
});

test('RLS protege filtros e armazenamento sem apagar dados ou cobranças',()=>{
  assert.match(dbSource,/access_paused boolean not null default false/);
  assert.match(dbSource,/not c\.access_paused/g);
  assert.match(dbSource,/private\.is_own_company\(id\)/);
  assert.match(dbSource,/settings support info read/);
  assert.match(dbSource,/key='branding'/);
  assert.doesNotMatch(dbSource,/\b(delete from|truncate|update public\.invoices)\b/i);
});
