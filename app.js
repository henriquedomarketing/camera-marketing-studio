import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

// Publishable browser configuration. NEVER add a service_role/secret key to this file.
const SUPABASE_URL = 'https://imfgumnpbxhbrjlkiphf.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_kJL7tvsZ-pTX6hm5JRTcFw_W66hhoxv';
const api = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {auth:{autoRefreshToken:true,persistSession:true}});
const $ = id=>document.getElementById(id);
const escapeHtml = v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const brl = n=>Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const dateBR = d=>d?new Date(d+'T12:00:00').toLocaleDateString('pt-BR'):'—';
const today=()=>new Date().toISOString().slice(0,10);
const id=()=>crypto.randomUUID();
const app={ user:null,profile:null,company:null,companies:[],categories:[],filters:[],invoices:[],settings:{},page:'dashboard', modal:null, selectedCategory:null,selectedFilter:null,stream:null,images:new Map(),processing:false,captureData:null };
let toastTimer;
const toast=(message)=>{const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),5000)};
const errorMessage=error=>error?.message||'Não foi possível concluir esta operação.';

const brandColor=(v,fallback)=>typeof v==='string'&&/^#[0-9a-fA-F]{6}$/.test(v)?v:fallback;
function brandInk(hex){const h=brandColor(hex,'#DB2032').slice(1);const c=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4));return c[0]*.2126+c[1]*.7152+c[2]*.0722>.38?'#131D34':'#FFFFFF';}
function brandStyle(company){const main=brandColor(company?.primary_color,'#071C70'),accent=brandColor(company?.accent_color,'#DB2032');return `--brand-primary:${main};--brand-accent:${accent};--brand-on-accent:${brandInk(accent)};--brand-on-primary:${brandInk(main)};`;}
const brandImg=(company,cls)=>company?.logo_path?`<img data-brand-logo="${escapeHtml(company.id)}" class="${cls}" alt="Logo da ${escapeHtml(company.name)}">`:'';

const option=(value,text,selected)=>`<option value="${escapeHtml(value)}" ${selected?'selected':''}>${escapeHtml(text)}</option>`;
const companyName=uid=>app.companies.find(c=>c.id===uid)?.name||'Empresa';
const categoryName=uid=>app.categories.find(c=>c.id===uid)?.name||'Categoria';
const badge=(status)=>{const cls=status==='paid'||status==='active'?'':status==='pending'?'warn':'danger';const txt={active:'Ativo',inactive:'Inativo',paid:'Pago',pending:'Pendente',overdue:'Atrasado',canceled:'Cancelado'}[status]||status;return `<span class="chip ${cls}">${txt}</span>`};
const dueStatus=invoice=>invoice.status==='paid'?'paid':invoice.status==='canceled'?'canceled':invoice.due_date<today()?'overdue':'pending';
const button=(label,action)=>`<button class="btn btn-primary" data-act="${action}">＋ ${label}</button>`;
const action=(what,uid,label,css='')=>`<button class="small-action ${css}" data-act="${what}" data-id="${escapeHtml(uid)}">${label}</button>`;
const header=(tag,title,subtitle,right='')=>`<div class="heading"><div><small>${tag}</small><h1>${title}</h1><p>${subtitle}</p></div>${right}</div>`;
const stat=(label,value,sub)=>`<div class="stat"><label>${label}</label><b>${value}</b><small>${sub}</small></div>`;
const field=(name,label,value='',type='text',required=true,minLength=0)=>`<div class="field"><label for="f_${name}">${label}</label><input id="f_${name}" name="${name}" type="${type}" value="${escapeHtml(value)}" ${minLength?`minlength="${minLength}" maxlength="128"`:''} ${required?'required':''}></div>`;
const select=(name,label,opts)=>`<div class="field"><label for="f_${name}">${label}</label><select name="${name}" id="f_${name}" required>${opts}</select></div>`;
const companyOptions=(selected='')=>app.companies.map(c=>option(c.id,c.name,c.id===selected)).join('');
const endForm='<div class="form-actions"><button type="button" class="btn" data-act="close-modal">Cancelar</button><button class="btn btn-primary" type="submit">Salvar</button></div>';
function stopCamera(){if(app.stream){app.stream.getTracks().forEach(t=>t.stop());app.stream=null;}}
function clearCapturedPhoto(){if(app.captureData?.url)URL.revokeObjectURL(app.captureData.url);app.captureData=null;}
function backToCamera(){clearCapturedPhoto();app.page='camera';render();window.scrollTo(0,0);}
function navigate(page){if(app.page==='camera'&&page!=='camera')stopCamera();if(page!=='preview')clearCapturedPhoto();app.page=page;app.selectedFilter=null;render();window.scrollTo(0,0);}
function authMarkup(register=false){return `<div class="auth-layout"><div class="auth-card"><div class="brand"><span class="brand-mark">CM</span><span>camera marketing<small>STUDIO</small></span></div><h1>${register?'Criar conta inicial':'Bem-vindo de volta'}</h1><p class="muted">${register?'Cadastre seu acesso. Ele só se tornará administrador após ativação segura no Supabase.':'Entre para acessar seu painel ou os filtros da sua empresa.'}</p><form class="form" id="authForm">${field('email','E-mail','','email')}${field('password','Senha','','password',true,register?8:0)}<button class="btn btn-primary btn-full" type="submit">${register?'Criar conta':'Entrar'}</button><div id="authError" class="auth-error"></div></form><button class="subtle-button auth-switch" type="button" data-act="${register?'login-view':'register-view'}">${register?'Já tenho conta. Entrar':'Primeiro acesso do administrador? Criar conta'}</button></div></div>`}
function layout(content){const admin=app.profile?.role==='admin';
  if(!admin){
    return `<div class="client-app ${app.page==='categories'?'is-home':'is-camera'}" style="${brandStyle(app.company)}">
      <header class="client-header">
        <div class="client-brand"><span class="client-brand-mark"><span class="client-brand-fallback">FP</span>${brandImg(app.company,'client-brand-logo')}</span>
          <span class="client-brand-copy"><strong>${escapeHtml(app.company?.name||'Minha empresa')}</strong>
          <small>FILTROS PERSONALIZADOS</small></span>
        </div>
        <button type="button" class="client-logout" data-act="logout" aria-label="Sair da conta">Sair</button>
      </header>
      <main class="client-content">${content}</main>
      <footer class="client-footer">CAMERA MARKETING • FILTROS PERSONALIZADOS</footer>
    </div>`;
  }
  const menu=admin?[['dashboard','◫ Visão geral'],['clients','♙ Clientes'],['categories','▦ Categorias'],['filters','▧ Filtros PNG'],['finance','▤ Financeiro'],['settings','⚙ Configurações']]:[['categories','▦ Categorias'],['camera','◎ Câmera']];return `<div class="layout"><aside class="sidebar"><div class="brand"><span class="brand-mark">CM</span><span>camera marketing<small>STUDIO</small></span></div><nav>${menu.map(([value,title])=>`<button class="nav-btn ${app.page===value?'active':''}" data-nav="${value}">${title}</button>`).join('')}</nav><div class="sidebar-bottom"><b>${admin?'Administrador':'Área do cliente'}</b><p>${escapeHtml(app.user?.email)}</p><button class="btn btn-full" data-act="logout">Sair da conta</button></div></aside><div class="workspace"><header class="topbar"><div>Workspace / <strong>${admin?'Painel administrativo':escapeHtml(app.company?.name)}</strong></div><div class="topbar-right"><span class="chip">Conta autenticada</span><button class="btn" data-act="logout">Sair</button></div></header><main class="content">${content}</main></div></div>${app.modal?`<div class="overlay" id="overlay"><div class="modal" role="dialog" aria-modal="true"><div class="modal-head"><h2>${escapeHtml(app.modal.title)}</h2><button class="btn" data-act="close-modal">✕</button></div>${app.modal.content}</div></div>`:''}`}
function table(headings,rows){return `<div class="table-wrap"><table class="table"><thead><tr>${headings.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows||`<tr><td class="empty" colspan="${headings.length}">Nenhum registro encontrado</td></tr>`}</tbody></table></div>`}
function dashboard(){const overdue=app.invoices.filter(i=>dueStatus(i)==='overdue'),unpaid=app.invoices.filter(i=>i.status==='pending');return header('DASHBOARD','Visão geral','Os indicadores abaixo são calculados a partir dos seus dados reais.',button('Cadastrar cliente','add-client'))+`<div class="stats">${stat('Clientes',app.companies.length,'Máximo permitido: 100')}${stat('Clientes ativos',app.companies.filter(x=>x.active).length,'Contas habilitadas')}${stat('Filtros PNG',app.filters.length,'Arquivos cadastrados')}${stat('Boletos atrasados',overdue.length,brl(unpaid.reduce((sum,i)=>sum+Number(i.amount),0))+' a receber')}</div>`+`<div class="card"><h2>Próximos vencimentos</h2>${table(['CLIENTE','VENCIMENTO','VALOR','STATUS'],app.invoices.slice().filter(i=>i.status==='pending').sort((a,b)=>a.due_date.localeCompare(b.due_date)).slice(0,8).map(i=>`<tr><td><b>${escapeHtml(companyName(i.company_id))}</b></td><td>${dateBR(i.due_date)}</td><td>${brl(i.amount)}</td><td>${badge(dueStatus(i))}</td></tr>`).join(''))}</div>`}
function clients(){return header('GERENCIAMENTO','Clientes','Cada empresa terá seu próprio login e seus próprios filtros.',button('Novo cliente','add-client'))+`<div class="card">${table(['CLIENTE','SITUAÇÃO','MENSALIDADE','VENCIMENTO','AÇÕES'],app.companies.map(c=>`<tr><td><div class="company-admin-name"><span class="company-admin-logo">${brandImg(c,'company-admin-logo-img')||'<span>▣</span>'}</span><span><b>${escapeHtml(c.name)}</b><small>${escapeHtml(c.contact_email)}</small></span></div></td><td>${badge(c.active?'active':'inactive')}</td><td>${brl(c.monthly_fee)}</td><td>${dateBR(c.next_due_date)}</td><td><div class="actions">${action('edit-client',c.id,'Editar')}${action('reset-password',c.id,'Nova senha')}${action('remove-client',c.id,'Excluir','danger')}</div></td></tr>`).join(''))}</div>`}
function categories(){return header('ORGANIZAÇÃO','Categorias','Separe os filtros de cada empresa por assunto.',button('Nova categoria','add-category'))+`<div class="card">${table(['CATEGORIA','CLIENTE','FILTROS','AÇÕES'],app.categories.map(c=>`<tr><td><b>${escapeHtml(c.name)}</b></td><td>${escapeHtml(companyName(c.company_id))}</td><td>${app.filters.filter(f=>f.category_id===c.id).length}</td><td><div class="actions">${action('edit-category',c.id,'Editar')}${action('remove-category',c.id,'Excluir','danger')}</div></td></tr>`).join(''))}</div>`}
function filters(){return header('BIBLIOTECA','Filtros PNG','PNGs privados, organizados por empresa e categoria.',button('Enviar PNG','add-filter'))+`<div class="card">${app.filters.length?`<div class="filters-grid">${app.filters.map(f=>`<div class="filter-card"><div class="filter-image"><img data-img="${f.id}" alt="Filtro ${escapeHtml(f.name)}"></div><b>${escapeHtml(f.name)}</b><small>${escapeHtml(companyName(f.company_id))} • ${escapeHtml(categoryName(f.category_id))}</small><div class="actions">${action('remove-filter',f.id,'Excluir','danger')}</div></div>`).join('')}</div>`:'<div class="empty">Nenhum filtro cadastrado. Envie seu primeiro PNG transparente.</div>'}</div>`}
function finance(){const pending=app.invoices.filter(x=>x.status==='pending'),paid=app.invoices.filter(x=>x.status==='paid'),late=pending.filter(x=>x.due_date<today());return header('COBRANÇAS','Financeiro','Controle manual de boletos; sem integração bancária automática.',button('Nova cobrança','add-invoice'))+`<div class="stats">${stat('A receber',brl(pending.reduce((s,x)=>s+Number(x.amount),0)),pending.length+' cobranças abertas')}${stat('Recebido',brl(paid.reduce((s,x)=>s+Number(x.amount),0)),paid.length+' pagamentos registrados')}${stat('Atrasado',brl(late.reduce((s,x)=>s+Number(x.amount),0)),late.length+' cobranças vencidas')}${stat('Empresas',app.companies.length,'Clientes cadastrados')}</div><div class="card">${table(['CLIENTE','VENCIMENTO','VALOR','STATUS','AÇÕES'],app.invoices.map(x=>`<tr><td><b>${escapeHtml(companyName(x.company_id))}</b></td><td>${dateBR(x.due_date)}</td><td>${brl(x.amount)}</td><td>${badge(dueStatus(x))}</td><td><div class="actions">${action('toggle-paid',x.id,x.status==='paid'?'Reabrir':'Marcar pago')}${action('edit-invoice',x.id,'Editar')}${action('remove-invoice',x.id,'Excluir','danger')}</div></td></tr>`).join(''))}</div>`}
function settings(){const branding=app.settings.branding||{};return header('PERSONALIZAÇÃO','Configurações','Altere o nome da plataforma e o WhatsApp de suporte.')+`<div class="card"><form id="settingsForm" class="form">${field('appName','Nome da plataforma',branding.appName||'Camera Marketing Studio')}${field('supportWhatsapp','WhatsApp de suporte',branding.supportWhatsapp||'', 'text',false)}<button type="submit" class="btn btn-primary">Salvar configurações</button></form><p class="note">O limite de 100 clientes é aplicado pelo banco. As senhas ficam no Supabase Auth e os PNGs em um armazenamento privado.</p></div>`}
function clientCategories(){
  return `<section class="client-home">
    <div class="client-home-heading">
      <div class="client-company-logo-wrap">${brandImg(app.company,'client-company-logo')||'<span class="client-logo-fallback">FP</span>'}</div>
      <span class="client-eyebrow">BEM-VINDO À ${escapeHtml(app.company?.name||'SUA EMPRESA')}</span>
      <h1>Escolha uma categoria</h1>
      <p>Selecione o tema para abrir a câmera e criar seu conteúdo.</p>
    </div>
    <div class="client-category-grid">${app.categories.map(c=>`<button type="button" data-act="open-category" data-id="${escapeHtml(c.id)}" class="client-category-item">
      <span class="client-category-symbol">▦</span>
      <span class="client-category-name">${escapeHtml(c.name)}</span>
      <small>${app.filters.filter(f=>f.category_id===c.id&&f.active).length} filtros disponíveis</small>
      <span class="client-category-arrow">›</span>
    </button>`).join('')||'<p class="client-empty">Nenhuma categoria disponível por enquanto. Fale com o administrador.</p>'}</div>
  </section>`;
}
function cameraView(){
  const filters=app.filters.filter(f=>f.category_id===app.selectedCategory&&f.active);
  return `<section class="client-camera-screen">
    <div class="client-camera-topline">
      <button type="button" class="client-back" data-act="back-categories" aria-label="Voltar às categorias">‹ <span>Voltar</span></button>
      <div class="client-category-title"><span class="client-eyebrow">CATEGORIA</span><strong>${escapeHtml(app.categories.find(c=>c.id===app.selectedCategory)?.name||'Filtros')}</strong></div>
    </div>
    <div class="client-viewfinder-wrap">
      <div class="camera-frame client-viewfinder">
        <video id="cameraVideo" autoplay playsinline muted></video>
        <img class="hidden" id="cameraOverlay" alt="Filtro sobre a câmera">
      </div>
    </div>
    <div class="client-filter-panel">
      <div class="client-filter-panel-top"><span>SELECIONE UM FILTRO</span><small>${filters.length} disponíveis</small></div>
      <div class="client-filter-strip" role="group" aria-label="Filtros disponíveis">
        ${filters.map(f=>`<button type="button" class="client-filter-choice ${app.selectedFilter===f.id?'active':''}" data-act="choose-filter" data-id="${escapeHtml(f.id)}" aria-label="Selecionar filtro ${escapeHtml(f.name)}" aria-pressed="${app.selectedFilter===f.id}">
          <span class="client-filter-circle"><img data-img="${escapeHtml(f.id)}" alt="" loading="lazy"></span>
          <span class="client-filter-name">${escapeHtml(f.name)}</span>
        </button>`).join('')||'<span class="client-empty-strip">Nenhum filtro nesta categoria.</span>'}
      </div>
    </div>
    <div class="client-photo-controls">
      <button type="button" data-act="flip-camera" class="client-control-secondary" aria-label="Alternar câmera" title="Alternar câmera"><span class="client-control-icon">⟳</span><small>Alternar</small></button>
      <button type="button" data-act="capture" class="client-shutter" aria-label="Fotografar" title="Fotografar"><span></span></button>
      <button type="button" data-act="activate-camera" class="client-control-secondary" aria-label="Ativar câmera" title="Ativar câmera"><span class="client-control-icon">◎</span><small>Ativar</small></button>
    </div>
    <p class="client-save-note">Escolha um filtro e fotografe. Arquivo final em 1080 × 1920.</p>
  </section>`;
}

function previewView(){
  if(!app.captureData)return '<div class="client-empty">Não há fotografia disponível.</div>';
  return `<section class="client-result" aria-label="Resultado da fotografia">
    <div class="client-result-heading"><span class="client-eyebrow">FOTO FINALIZADA · 1080 × 1920</span>
      <h1>Sua foto ficou pronta! <span aria-hidden="true">✨</span></h1>
      <p>Confira o resultado com o filtro aplicado e escolha como deseja usar.</p>
    </div>
    <figure class="client-result-preview"><img src="${escapeHtml(app.captureData.url)}" alt="Prévia da foto capturada com o filtro aplicado"><figcaption>Pronta para publicar nos Stories</figcaption></figure>
    <div class="client-result-actions">
      <button type="button" class="client-result-btn client-result-share" data-act="photo-share"><span aria-hidden="true">↗</span> Compartilhar foto</button>
      <div class="client-result-grid">
        <button type="button" class="client-result-btn client-result-instagram" data-act="photo-instagram"><span aria-hidden="true">◎</span> Instagram Stories</button>
        <button type="button" class="client-result-btn client-result-whatsapp" data-act="photo-whatsapp"><span aria-hidden="true">✆</span> WhatsApp</button>
      </div>
      <button type="button" class="client-result-btn client-result-save" data-act="photo-save"><span aria-hidden="true">↓</span> Salvar no celular</button>
      <div class="client-result-secondary">
        <button type="button" data-act="photo-retake">↻ Nova foto</button>
        <button type="button" data-act="photo-change-filter">◉ Trocar filtro</button>
      </div>
    </div>
    <p class="client-result-note">Instagram e WhatsApp dependem das opções disponíveis no compartilhamento do seu celular. No iPhone, use <b>Salvar Imagem</b> ou <b>Salvar em Arquivos</b> para guardar a foto.</p>
  </section>`;
}

function waiting(){return `<div class="auth-layout"><div class="card pending"><div class="brand"><span class="brand-mark">CM</span><span>Camera Marketing Studio</span></div><h2>Conta aguardando ativação</h2><p class="muted">Seu cadastro existe, mas ainda não foi vinculado a uma empresa ou autorizado como administrador. Solicite a ativação ao responsável.</p><button class="btn" data-act="logout">Sair</button></div></div>`}
function render(){if(!app.user){$('root').innerHTML=authMarkup(app.register);return;}if(!app.profile||app.profile.role!=='admin'&&!app.company){$('root').innerHTML=waiting();return;}const admin=app.profile.role==='admin';const content=admin?({dashboard,clients,categories,filters,finance,settings}[app.page]||dashboard)():(app.page==='preview'&&app.captureData?previewView():app.page==='camera'&&app.selectedCategory?cameraView():clientCategories());$('root').innerHTML=layout(content);hydrateImages();hydrateBrandLogos();if(!admin&&app.page==='camera'&&app.selectedCategory){startCamera();if(app.selectedFilter)selectFilter(app.selectedFilter);}}
async function loadData(){if(!app.user)return;const {data:profile,error}=await api.from('profiles').select('*').eq('id',app.user.id).single();if(error)throw error;app.profile=profile;const admin=profile.role==='admin';if(admin){const [a,b,c,d,s]=await Promise.all([api.from('companies').select('*').order('created_at',{ascending:false}),api.from('categories').select('*').order('sort_order'),api.from('filters').select('*').order('sort_order'),api.from('invoices').select('*').order('due_date',{ascending:true}),api.from('app_settings').select('*')]);for(const x of [a,b,c,d,s])if(x.error)throw x.error;app.companies=a.data;app.categories=b.data;app.filters=c.data;app.invoices=d.data;app.settings=Object.fromEntries(s.data.map(x=>[x.key,x.value]));app.page=['categories','camera'].includes(app.page)?'dashboard':app.page;}else{app.company=null;if(profile.company_id){const [co,cat,fil]=await Promise.all([api.from('companies').select('*').eq('id',profile.company_id).maybeSingle(),api.from('categories').select('*').eq('company_id',profile.company_id).order('sort_order'),api.from('filters').select('*').eq('company_id',profile.company_id).eq('active',true).order('sort_order')]);for(const x of [co,cat,fil])if(x.error)throw x.error;app.company=co.data;app.categories=cat.data;app.filters=fil.data;}app.page='categories';}render();}
async function refresh(){await loadData();toast('Dados atualizados.');}
async function init(){const {data:{session}}=await api.auth.getSession();app.user=session?.user||null;if(app.user){try{await loadData()}catch(error){toast(errorMessage(error));$('root').innerHTML=waiting()}}else render();}
async function authSubmit(form){const data=Object.fromEntries(new FormData(form));$('authError').textContent='';const submit=form.querySelector('button[type=submit]');submit.disabled=true;try{const {data:auth,error}=app.register?await api.auth.signUp({email:data.email,password:data.password}):await api.auth.signInWithPassword({email:data.email,password:data.password});if(error)throw error;if(!auth.session){toast('Cadastro recebido! Confira seu e-mail para confirmar a conta.');app.register=false;render();return;}app.user=auth.user;await loadData();}catch(error){const node=$('authError');if(node)node.textContent=errorMessage(error)}finally{if(submit.isConnected)submit.disabled=false;}}
async function manager(body){
  const {data,error}=await api.functions.invoke('manage-client',{body});
  if(error){
    // Supabase FunctionsHttpError carries a Response in context, not a parsed error.
    // Read the server's JSON safely so a validation error is actionable.
    let details='';
    const response=error.context;
    if(response && typeof response.clone==='function'){
      try{
        const payload=await response.clone().json();
        if(typeof payload?.error==='string')details=payload.error;
        else if(typeof payload?.message==='string')details=payload.message;
      }catch{
        try{details=(await response.clone().text()).slice(0,240)}catch{}
      }
    }
    throw new Error(details||error.message||'Falha na comunicação com o servidor.');
  }
  if(data?.error)throw new Error(data.error);
  return data;
}
function openModal(title,body,formId){app.modal={title,content:body,formId};render();}
function closeModal(){app.modal=null;render();}
function companyModal(cid){
  const c=app.companies.find(x=>x.id===cid);
  const logoInfo=c?.logo_path?`<span class="brand-form-current-logo">${brandImg(c,'brand-form-logo-img')}<small>Logo atual da empresa</small></span>`:'';
  const frm=`<form class="form" id="clientForm">
    ${field('name','Nome da empresa',c?.name)}
    ${field('email','E-mail do login',c?.contact_email,'email',!c)}
    ${!c?field('password','Senha inicial (8 caracteres ou mais)','','password',true,8):''}
    <div class="branding-form-section">
      <strong>Identidade visual da empresa</strong>
      <p>Cadastre a logo original em PNG 500 × 500 e escolha as cores que aparecerão após o login do cliente.</p>
      ${logoInfo}
      <div class="field">
        <label for="companyLogo">Logo PNG 500 × 500 (máximo 2 MB)${c?' — opcional para substituir':''}</label>
        <input id="companyLogo" type="file" name="logo" accept=".png,image/png" ${c?'':'required'}>
      </div>
      <div class="brand-color-grid">
        ${field('primary_color','Cor principal',brandColor(c?.primary_color,'#071C70'),'color')}
        ${field('accent_color','Cor dos botões',brandColor(c?.accent_color,'#DB2032'),'color')}
      </div>
    </div>
    ${field('phone','Telefone/WhatsApp',c?.phone||'','text',false)}
    ${field('monthly_fee','Mensalidade em reais',c?.monthly_fee||0,'number')}
    ${field('due_day','Dia do vencimento',c?.due_day||10,'number')}
    ${field('next_due_date','Próximo vencimento',c?.next_due_date||'','date',false)}
    ${c?select('active','Situação',option('true','Ativo',c.active)+option('false','Inativo',!c.active)):''}
    ${endForm}</form>`;
  openModal(c?'Editar cliente':'Cadastrar cliente',frm,'clientForm');
  app.modal.recordId=c?.id||null;
}
function categoryModal(cid){const c=app.categories.find(x=>x.id===cid);openModal(c?'Editar categoria':'Nova categoria',`<form class="form" id="categoryForm">${select('company_id','Empresa',companyOptions(c?.company_id))}${field('name','Categoria',c?.name||'')}${endForm}</form>`,'categoryForm');app.modal.recordId=c?.id||null;}
function invoiceModal(iid){const i=app.invoices.find(x=>x.id===iid);openModal(i?'Editar cobrança':'Nova cobrança',`<form class="form" id="invoiceForm">${select('company_id','Empresa',companyOptions(i?.company_id))}${field('amount','Valor (R$)',i?.amount??0,'number')}${field('due_date','Vencimento',i?.due_date||today(),'date')}${select('status','Situação',option('pending','Pendente',!i||i.status==='pending')+option('paid','Pago',i?.status==='paid')+option('canceled','Cancelado',i?.status==='canceled'))}${field('notes','Observações',i?.notes||'','text',false)}${endForm}</form>`,'invoiceForm');app.modal.recordId=i?.id||null;}
function filterModal(){openModal('Cadastrar filtro PNG',`<form class="form" id="filterForm">${select('company_id','Empresa',companyOptions())}<div class="field"><label>Categoria</label><select name="category_id" id="filterCategory" required></select></div>${field('name','Nome do filtro')}${field('sort_order','Ordem',0,'number')}<div class="field"><label>PNG transparente (máximo 12 MB)</label><input type="file" name="file" accept="image/png,.png" required></div><p class="muted">Recomendado: imagem vertical 1080 × 1920 com transparência real.</p>${endForm}</form>`,'filterForm');updateCategoryOptions();}
function updateCategoryOptions(){const form=$('filterForm');if(!form)return;const clientId=form.elements.company_id.value;const target=$('filterCategory');target.innerHTML=app.categories.filter(c=>c.company_id===clientId).map(c=>option(c.id,c.name,false)).join('');}
async function validatePNG(file){if(!file||file.type!=='image/png'||file.size>12582912)throw Error('Selecione um PNG válido de até 12 MB.');const uri=URL.createObjectURL(file);try{const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('PNG não reconhecido.'));img.src=uri;});const canvas=document.createElement('canvas');canvas.width=100;canvas.height=178;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,100,178);const pixels=ctx.getImageData(0,0,100,178).data;let transparent=false,visible=false;for(let i=3;i<pixels.length;i+=4){if(pixels[i]<240)transparent=true;if(pixels[i]>15)visible=true;if(transparent&&visible)break;}if(!transparent||!visible)throw Error('O filtro precisa ter elementos visíveis e fundo transparente.');}finally{URL.revokeObjectURL(uri);}}
async function filterUpload(form){const file=form.elements.file.files[0];await validatePNG(file);const c=form.elements.company_id.value,category=form.elements.category_id.value;const path=`${c}/${id()}.png`;const {error:uploadError}=await api.storage.from('company-filters').upload(path,file,{contentType:'image/png',upsert:false});if(uploadError)throw uploadError;const payload={company_id:c,category_id:category,name:form.elements.name.value.trim(),sort_order:Number(form.elements.sort_order.value),storage_path:path};const {error}=await api.from('filters').insert(payload);if(error){await api.storage.from('company-filters').remove([path]);throw error;}}

async function validateCompanyLogo(file){
  if(!file)return;
  if(file.type!=='image/png'||file.size>2*1024*1024||file.size<8)
    throw Error('A logo deve ser um arquivo PNG de até 2 MB.');
  const uri=URL.createObjectURL(file);
  try{
    const img=new Image();
    await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('A logo selecionada não é um PNG válido.'));img.src=uri;});
    if(img.naturalWidth!==500||img.naturalHeight!==500)
      throw Error('A logo precisa ter exatamente 500 × 500 pixels.');
  }finally{URL.revokeObjectURL(uri);}
}
async function uploadCompanyLogo(companyId,file){
  const path=`${companyId}/branding/${id()}.png`;
  const {error}=await api.storage.from('company-filters').upload(path,file,{contentType:'image/png',cacheControl:'3600',upsert:false});
  if(error)throw error;
  return path;
}
async function saveCompanyBrand(companyId,values,logo,oldLogo){
  const payload={primary_color:brandColor(values.primary_color,'#071C70'),accent_color:brandColor(values.accent_color,'#DB2032')};
  let uploaded=null;
  try{
    if(logo){uploaded=await uploadCompanyLogo(companyId,logo);payload.logo_path=uploaded;}
    const {error}=await api.from('companies').update(payload).eq('id',companyId);
    if(error)throw error;
  }catch(error){
    if(uploaded)await api.storage.from('company-filters').remove([uploaded]);
    throw error;
  }
  if(uploaded&&oldLogo&&oldLogo!==uploaded){
    const {error:cleanup}=await api.storage.from('company-filters').remove([oldLogo]);
    if(cleanup)console.warn('Logo anterior necessita de limpeza:',cleanup.message);
  }
}
async function brandLogoUrl(company){
  if(!company?.logo_path)return null;
  const key='brand:'+company.logo_path;
  if(app.images.has(key))return app.images.get(key);
  const {data,error}=await api.storage.from('company-filters').download(company.logo_path);
  if(error)throw error;
  const uri=URL.createObjectURL(data);
  app.images.set(key,uri);
  return uri;
}
function hydrateBrandLogos(){
  document.querySelectorAll('[data-brand-logo]').forEach(element=>{
    const company=app.companies.find(c=>c.id===element.dataset.brandLogo)||
      (app.company?.id===element.dataset.brandLogo?app.company:null);
    if(!company?.logo_path)return;
    brandLogoUrl(company).then(uri=>{if(element.isConnected)element.src=uri;})
      .catch(()=>{if(element.isConnected)element.alt='Logo indisponível';});
  });
}

async function handleForm(event){event.preventDefault();const form=event.target;const values=Object.fromEntries(new FormData(form));const button=form.querySelector('button[type=submit]');if(button)button.disabled=true;try{if(form.id==='authForm')return await authSubmit(form);if(form.id==='clientForm'){
  const logo=values.logo instanceof File&&values.logo.size>0?values.logo:null;
  await validateCompanyLogo(logo);
  const c=app.companies.find(x=>x.id===app.modal?.recordId);
  if(c){
    const payload={name:values.name,contact_email:values.email,phone:values.phone,
      monthly_fee:Number(values.monthly_fee),due_day:Number(values.due_day),
      next_due_date:values.next_due_date||null,active:values.active==='true'};
    const {error}=await api.from('companies').update(payload).eq('id',c.id);
    if(error)throw error;
    await saveCompanyBrand(c.id,values,logo,c.logo_path);
  }else{
    if(!logo)throw Error('Envie a logo PNG 500 × 500 da empresa.');
    const created=await manager({action:'create',name:values.name,email:values.email,password:values.password,
      phone:values.phone,monthly_fee:Number(values.monthly_fee),due_day:Number(values.due_day),
      next_due_date:values.next_due_date||null});
    try{await saveCompanyBrand(created.company_id,values,logo,null);}
    catch(error){
      await loadData();
      throw new Error('Cliente cadastrado, mas a personalização ficou pendente: '+errorMessage(error)+'. Abra Editar para reenviar a logo.');
    }
  }
}if(form.id==='categoryForm'){const p={company_id:values.company_id,name:values.name.trim()};const q=app.modal.recordId?api.from('categories').update(p).eq('id',app.modal.recordId):api.from('categories').insert(p);const {error}=await q;if(error)throw error;}if(form.id==='invoiceForm'){const p={company_id:values.company_id,amount:Number(values.amount),due_date:values.due_date,status:values.status,paid_at:values.status==='paid'?new Date().toISOString():null,notes:values.notes||null};const q=app.modal.recordId?api.from('invoices').update(p).eq('id',app.modal.recordId):api.from('invoices').insert(p);const {error}=await q;if(error)throw error;}if(form.id==='filterForm')await filterUpload(form);if(form.id==='passwordForm')await manager({action:'reset_password',company_id:app.modal.recordId,password:values.password});if(form.id==='settingsForm'){const branding={...app.settings.branding,appName:values.appName,supportWhatsapp:values.supportWhatsapp};const {error}=await api.from('app_settings').upsert({key:'branding',value:branding});if(error)throw error;}app.modal=null;await loadData();toast('Alterações salvas com sucesso.');}catch(error){toast(errorMessage(error))}finally{if(button?.isConnected)button.disabled=false;}}
async function mediaUrl(filter){if(app.images.has(filter.id))return app.images.get(filter.id);const {data,error}=await api.storage.from('company-filters').download(filter.storage_path);if(error)throw error;const uri=URL.createObjectURL(data);app.images.set(filter.id,uri);return uri;}
async function hydrateImages(){const imgs=document.querySelectorAll('[data-img]');for(const element of imgs){const filter=app.filters.find(f=>f.id===element.dataset.img);if(!filter)continue;mediaUrl(filter).then(url=>{if(element.isConnected)element.src=url}).catch(()=>{if(element.isConnected)element.alt='PNG indisponível';});}}
async function startCamera(facing='environment'){const video=$('cameraVideo');if(!video)return;stopCamera();try{const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:facing},width:{ideal:1920},height:{ideal:1080}}});app.stream=stream;video.srcObject=stream;await video.play();app.facing=facing;}catch(error){toast('Autorize a câmera no Safari ou Chrome. '+errorMessage(error))}}
function selectFilter(fid){
  app.selectedFilter=fid;
  document.querySelectorAll('.client-filter-choice').forEach(b=>{
    const selected=b.dataset.id===fid;
    b.classList.toggle('active',selected);
    b.setAttribute('aria-pressed',String(selected));
  });
  const img=$('cameraOverlay');
  const filter=app.filters.find(f=>f.id===fid);
  if(!filter||!img)return;
  img.classList.add('hidden');
  img.removeAttribute('src');
  mediaUrl(filter).then(url=>{
    if(!img.isConnected||app.selectedFilter!==fid)return;
    img.src=url;
    img.classList.remove('hidden');
  }).catch(error=>toast('Não foi possível carregar o filtro: '+errorMessage(error)));
}

async function capture(){
  if(app.processing)return;
  const video=$('cameraVideo');
  if(!video||!video.videoWidth||!video.videoHeight||!app.selectedFilter){
    toast('Ative a câmera e selecione um filtro.');return;
  }
  const filter=app.filters.find(f=>f.id===app.selectedFilter);
  if(!filter)return;
  app.processing=true;
  const shutter=document.querySelector('[data-act="capture"]');
  if(shutter)shutter.disabled=true;
  try{
    const src=await mediaUrl(filter);
    const overlay=new Image();
    overlay.src=src;
    await new Promise((resolve,reject)=>{
      if(overlay.complete&&overlay.naturalWidth>0){resolve();return;}
      overlay.onload=resolve;overlay.onerror=()=>reject(new Error('Não foi possível aplicar o PNG ao resultado.'));
    });
    if(!video.videoWidth||!app.stream)throw new Error('A câmera parou. Ative-a novamente.');
    const canvas=document.createElement('canvas');
    canvas.width=1080;canvas.height=1920;
    const ctx=canvas.getContext('2d');
    if(!ctx)throw new Error('Não foi possível preparar a fotografia.');
    const sw=video.videoWidth,sh=video.videoHeight,ratio=9/16;
    let cw=sw,ch=sw/ratio;
    if(ch>sh){ch=sh;cw=sh*ratio;}
    ctx.drawImage(video,(sw-cw)/2,(sh-ch)/2,cw,ch,0,0,1080,1920);
    ctx.drawImage(overlay,0,0,1080,1920);
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Não foi possível gerar a foto.')),'image/png'));
    const name='camera-marketing-'+Date.now()+'.png';
    clearCapturedPhoto();
    app.captureData={blob,file:new File([blob],name,{type:'image/png'}),url:URL.createObjectURL(blob),name};
    stopCamera();
    app.page='preview';
    render();
    window.scrollTo(0,0);
  }catch(error){toast(errorMessage(error));}
  finally{app.processing=false;if(shutter?.isConnected)shutter.disabled=false;}
}
function shareCapturedPhoto(target='general'){
  const photo=app.captureData;
  if(!photo){toast('Fotografe primeiro para compartilhar.');return;}
  const file=photo.file;
  if(typeof navigator.share!=='function'||(typeof navigator.canShare==='function'&&!navigator.canShare({files:[file]}))){
    toast('O compartilhamento de imagens não está disponível aqui. Use Salvar no celular e abra a imagem no aplicativo desejado.');
    return;
  }
  if(target==='whatsapp')toast('Na lista de aplicativos, escolha WhatsApp para enviar a foto.');
  if(target==='instagram')toast('Na lista de aplicativos, escolha Instagram e, se disponível, Stories.');
  if(target==='save')toast('No iPhone, escolha Salvar Imagem ou Salvar em Arquivos.');
  // Must be invoked directly from the button's user gesture; do not await before navigator.share.
  navigator.share({files:[file],title:'Foto com filtro'})
    .catch(error=>{
      if(error?.name!=='AbortError')toast('Não foi possível compartilhar. Tente Salvar no celular.');
    });
}
function downloadCapturedPhoto(){
  const photo=app.captureData;
  if(!photo){toast('Fotografe primeiro para salvar.');return;}
  const a=document.createElement('a');
  a.href=photo.url;a.download=photo.name;
  document.body.appendChild(a);a.click();a.remove();
  toast('Download solicitado. Confira Arquivos ou Downloads no celular.');
}
function saveCapturedPhoto(){
  const isIOS=/iPhone|iPad|iPod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const canShareFile=app.captureData && typeof navigator.share==='function' &&
    (typeof navigator.canShare!=='function'||navigator.canShare({files:[app.captureData.file]}));
  if(isIOS&&canShareFile)shareCapturedPhoto('save');
  else downloadCapturedPhoto();
}

async function click(event){const target=event.target.closest('[data-act],[data-nav]');if(!target)return;if(target.dataset.nav){navigate(target.dataset.nav);return;}const act=target.dataset.act,uid=target.dataset.id;try{if(act==='login-view'||act==='register-view'){app.register=act==='register-view';render();return;}if(act==='logout'){stopCamera();clearCapturedPhoto();app.images.forEach(v=>URL.revokeObjectURL(v));app.images.clear();await api.auth.signOut();app.user=null;app.profile=null;app.company=null;app.modal=null;render();return;}if(act==='close-modal'){closeModal();return;}if(act==='add-client'||act==='edit-client'){companyModal(act==='edit-client'?uid:null);return;}if(act==='add-category'||act==='edit-category'){categoryModal(act==='edit-category'?uid:null);return;}if(act==='add-invoice'||act==='edit-invoice'){invoiceModal(act==='edit-invoice'?uid:null);return;}if(act==='add-filter'){filterModal();return;}if(act==='reset-password'){openModal('Alterar senha do cliente',`<form class="form" id="passwordForm">${field('password','Nova senha (mínimo 8 caracteres)','','password',true,8)}${endForm}</form>`,'passwordForm');app.modal.recordId=uid;render();return;}if(act==='remove-client'){if(confirm('Excluir a empresa, seu login, categorias e PNGs? Esta ação é irreversível.')){await manager({action:'delete',company_id:uid});await refresh();}return;}if(act==='remove-category'){if(confirm('Excluir esta categoria? Os filtros vinculados também serão excluídos.')){const {error}=await api.from('categories').delete().eq('id',uid);if(error)throw error;await refresh();}return;}if(act==='remove-filter'){if(confirm('Excluir este filtro permanentemente?')){const filter=app.filters.find(f=>f.id===uid);if(!filter)return;const {error}=await api.from('filters').delete().eq('id',uid);if(error)throw error;const removed=await api.storage.from('company-filters').remove([filter.storage_path]);if(removed.error)toast('Cadastro removido, mas o PNG precisa de limpeza no Storage.');await refresh();}return;}if(act==='remove-invoice'){if(confirm('Excluir esta cobrança?')){const {error}=await api.from('invoices').delete().eq('id',uid);if(error)throw error;await refresh();}return;}if(act==='toggle-paid'){const invoice=app.invoices.find(i=>i.id===uid);const paid=invoice.status!=='paid';const {error}=await api.from('invoices').update({status:paid?'paid':'pending',paid_at:paid?new Date().toISOString():null}).eq('id',uid);if(error)throw error;await refresh();return;}if(act==='open-category'){app.selectedCategory=uid;app.selectedFilter=app.filters.find(f=>f.category_id===uid&&f.active)?.id||null;app.page='camera';render();return;}if(act==='back-categories'){navigate('categories');return;}if(act==='choose-filter'){selectFilter(uid);return;}if(act==='activate-camera'){await startCamera();return;}if(act==='flip-camera'){await startCamera(app.facing==='user'?'environment':'user');return;}if(act==='capture'){capture();return;}if(act==='photo-share'){shareCapturedPhoto();return;}if(act==='photo-instagram'){shareCapturedPhoto('instagram');return;}if(act==='photo-whatsapp'){shareCapturedPhoto('whatsapp');return;}if(act==='photo-save'){saveCapturedPhoto();return;}if(act==='photo-retake'||act==='photo-change-filter'){backToCamera();return;}}catch(error){toast(errorMessage(error));}}
$('root').addEventListener('click',click);
$('root').addEventListener('submit',handleForm);
$('root').addEventListener('change',event=>{if(event.target.id==='f_company_id'&&app.modal?.formId==='filterForm')updateCategoryOptions();});
init();
