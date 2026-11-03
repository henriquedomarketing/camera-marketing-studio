import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const src=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const edge=readFileSync(new URL('../supabase/functions/manage-client/index.ts',import.meta.url),'utf8');
const finance=readFileSync(new URL('../supabase/migrations/20261102_004_auto_monthly_finance.sql',import.meta.url),'utf8');
const start=src.indexOf('function clientBillingFromForm(');
const end=src.indexOf('function companyModal(',start);
assert.ok(start>0&&end>start,'Regra de pagamento disponível');
const billing=new Function(src.slice(start,end)+'\nreturn clientBillingFromForm;')();

test('Sem valor, data ou celular: acesso gratuito sem vencimento',()=>{
  assert.deepEqual(billing({monthly_fee:'',due_day:'',next_due_date:'',phone:''}),{
    monthly_fee:0,due_day:10,next_due_date:null
  });
});

test('Gratuito ignora datas inseridas e não gera vencimento financeiro',()=>{
  assert.deepEqual(billing({monthly_fee:'0',due_day:'15',next_due_date:'2026-12-15'}),{
    monthly_fee:0,due_day:10,next_due_date:null
  });
});

test('Pagante pode indicar somente dia ou data do próximo vencimento',()=>{
  assert.deepEqual(billing({monthly_fee:'1800.50',due_day:'10',next_due_date:''}),{
    monthly_fee:1800.5,due_day:10,next_due_date:null
  });
  assert.deepEqual(billing({monthly_fee:'250',due_day:'',next_due_date:'2026-12-15'}),{
    monthly_fee:250,due_day:15,next_due_date:'2026-12-15'
  });
});

test('Valor pagante sem vencimento pede preenchimento claro',()=>{
  assert.throws(()=>billing({monthly_fee:'100',due_day:'',next_due_date:''}),/cliente pagante/);
  assert.throws(()=>billing({monthly_fee:'-1',due_day:'',next_due_date:''}),/mensalidade válida/);
  assert.throws(()=>billing({monthly_fee:'100',due_day:'32',next_due_date:''}),/entre 1 e 31/);
});

test('Formulário e lista diferenciam gratuitos de pagantes',()=>{
  const modal=src.slice(src.indexOf('function companyModal('),src.indexOf('function categoryModal('));
  assert.match(modal,/Financeiro e contato/);
  assert.match(modal,/Telefone\/WhatsApp \(opcional\)/);
  assert.match(modal,/Mensalidade em reais \(vazio = gratuito\)/);
  assert.match(modal,/Dia do vencimento \(somente pagantes\)/);
  assert.match(modal,/Próximo vencimento \(opcional\)/);
  assert.match(src,/Gratuito \/ isento/);
});

test('Backend suporta campos ausentes; mensalidade zero não cria cobrança automática',()=>{
  assert.match(edge,/rawFee === "" \|\| rawFee == null \? 0/);
  assert.match(edge,/monthlyFee === 0 \? 10/);
  assert.match(edge,/next_due_date: monthlyFee > 0 \? nextDueDate \|\| null : null/);
  assert.match(finance,/if not new.active or new.monthly_fee <= 0 then/);
  assert.match(finance,/status='canceled'/);
});
