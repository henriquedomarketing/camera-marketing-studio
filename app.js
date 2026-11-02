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
const app={ user:null,profile:null,company:null,companies:[],categories:[],filters:[],invoices:[],settings:{},page:'dashboard', modal:null, selectedCategory:null,selectedFilter:null,stream:null,images:new Map(),processing:false,captureData:null,galleryPhoto:null,cameraRequestId:0 };
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
function stopCamera(){
  app.cameraRequestId++;
  if(app.stream){app.stream.getTracks().forEach(t=>t.stop());app.stream=null;}
}
function clearGalleryPhoto(){
  if(app.galleryPhoto?.url)URL.revokeObjectURL(app.galleryPhoto.url);
  app.galleryPhoto=null;
}
function clearCapturedPhoto(){if(app.captureData?.url)URL.revokeObjectURL(app.captureData.url);app.captureData=null;}
function backToCamera(keepGallery=false){
  clearCapturedPhoto();
  if(!keepGallery)clearGalleryPhoto();
  app.page='camera';render();window.scrollTo(0,0);
}
function navigate(page){document.body.classList.remove('mobile-menu-lock');if(app.page==='camera'&&page!=='camera')stopCamera();if(page!=='preview')clearCapturedPhoto();if(page!=='camera')clearGalleryPhoto();app.page=page;app.selectedFilter=null;render();window.scrollTo(0,0);}
function authMarkup(register=false){return `<div class="auth-layout"><div class="auth-card"><div class="brand"><span class="brand-mark">CM</span><span>camera marketing<small>STUDIO</small></span></div><h1>${register?'Criar conta inicial':'Bem-vindo de volta'}</h1><p class="muted">${register?'Cadastre seu acesso. Ele só se tornará administrador após ativação segura no Supabase.':'Entre para acessar seu painel ou os filtros da sua empresa.'}</p><form class="form" id="authForm">${field('email','E-mail','','email')}${field('password','Senha','','password',true,register?8:0)}<button class="btn btn-primary btn-full" type="submit">${register?'Criar conta':'Entrar'}</button><div id="authError" class="auth-error"></div></form><button class="subtle-button auth-switch" type="button" data-act="${register?'login-view':'register-view'}">${register?'Já tenho conta. Entrar':'Primeiro acesso do administrador? Criar conta'}</button></div></div>`}
function layout(content){const admin=app.profile?.role==='admin';
  if(!admin){
    const home=app.page==='categories';
    const type=home?'is-home':app.page==='preview'?'is-preview':'is-camera';
    const clientBrand=home
      ? `<div class="client-brand">
          <span class="client-brand-mark"><span class="client-brand-fallback">FP</span>${brandImg(app.company,'client-brand-logo')}</span>
          <span class="client-brand-copy"><strong>${escapeHtml(app.company?.name||'Minha empresa')}</strong><small>FILTROS PERSONALIZADOS</small></span>
        </div>`
      : `<div class="client-brand client-platform-brand">
          <span class="client-brand-mark client-platform-mark">CM</span>
          <span class="client-brand-copy"><strong>camera marketing</strong><small>STUDIO</small></span>
        </div>`;
    const cameraMode=type==='is-camera';
    const cameraDrawer=cameraMode?`<div class="client-camera-menu-backdrop" data-act="close-client-menu" aria-hidden="true"></div>
      <aside class="client-camera-drawer" id="clientCameraDrawer" aria-label="Menu de categorias" aria-hidden="true" inert>
        <div class="client-camera-drawer-heading"><strong>${escapeHtml(app.company?.name||'Minha empresa')}</strong>
          <button type="button" class="client-camera-drawer-close" data-act="close-client-menu" aria-label="Fechar menu">✕</button>
        </div>
        <p class="client-camera-drawer-label">ESCOLHA UMA CATEGORIA</p>
        <nav class="client-camera-drawer-list" aria-label="Categorias da empresa">
          ${app.categories.map(c=>`<button type="button" class="client-camera-drawer-category ${app.selectedCategory===c.id?'selected':''}" data-act="client-switch-category" data-id="${escapeHtml(c.id)}" ${app.selectedCategory===c.id?'aria-current="page"':''}>${escapeHtml(c.name)}<span aria-hidden="true">›</span></button>`).join('')}
        </nav>
        <div class="client-camera-drawer-bottom">
          <button type="button" data-act="back-categories">⌂ <span>Página inicial</span></button>
          <button type="button" data-act="logout">↪ <span>Sair da conta</span></button>
        </div>
      </aside>`:'';
    return `<div class="client-app ${type}" ${home?`style="${brandStyle(app.company)}"`:''}>
      ${cameraMode?'':`<header class="client-header">
        ${clientBrand}
        <button type="button" class="client-logout" data-act="logout" aria-label="Sair da conta">Sair</button>
      </header>`}
      <main class="client-content">${content}</main>
      ${cameraMode?'':`<footer class="client-footer">CAMERA MARKETING • FILTROS PERSONALIZADOS</footer>`}
      ${cameraDrawer}
    </div>`;
  }
  const menu=[['dashboard','◫ Visão geral'],['clients','♙ Clientes'],['filters','▧ Filtros PNG'],['finance','▤ Financeiro'],['settings','⚙ Configurações']];
  return `<div class="layout admin-layout" id="adminLayout">
    <button type="button" class="mobile-menu-backdrop" data-act="close-mobile-menu" tabindex="-1" aria-label="Fechar menu"></button>
    <aside class="sidebar" id="adminSidebar" aria-label="Menu administrativo">
      <div class="admin-sidebar-head">
        <div class="brand"><span class="brand-mark">CM</span><span>camera marketing<small>STUDIO</small></span></div>
        <button type="button" class="sidebar-close" data-act="close-mobile-menu" aria-label="Fechar menu">✕</button>
      </div>
      <nav aria-label="Navegação do painel">${menu.map(([value,title])=>`<button class="nav-btn ${app.page===value?'active':''}" data-nav="${value}">${title}</button>`).join('')}</nav>
      <div class="sidebar-bottom"><b>Administrador</b><p>${escapeHtml(app.user?.email)}</p><button class="btn btn-full" data-act="logout">Sair da conta</button></div>
    </aside>
    <div class="workspace">
      <header class="topbar">
        <div class="admin-topbar-start">
          <button type="button" class="mobile-menu-toggle" data-act="open-mobile-menu" aria-label="Abrir menu" aria-controls="adminSidebar" aria-expanded="false">
            <span aria-hidden="true">☰</span>
          </button>
          <div class="admin-breadcrumb">Workspace / <strong>Painel administrativo</strong></div>
        </div>
        <div class="topbar-right"><span class="chip">Conta autenticada</span><button class="btn" data-act="logout">Sair</button></div>
      </header>
      <main class="content">${content}</main>
    </div>
  </div>${app.modal?`<div class="overlay" id="overlay"><div class="modal" role="dialog" aria-modal="true"><div class="modal-head"><h2>${escapeHtml(app.modal.title)}</h2><button class="btn" data-act="close-modal">✕</button></div>${app.modal.content}</div></div>`:''}`;
}
function table(headings,rows){return `<div class="table-wrap"><table class="table"><thead><tr>${headings.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows||`<tr><td class="empty" colspan="${headings.length}">Nenhum registro encontrado</td></tr>`}</tbody></table></div>`}
function dashboard(){const overdue=app.invoices.filter(i=>dueStatus(i)==='overdue'),unpaid=app.invoices.filter(i=>i.status==='pending');return header('DASHBOARD','Visão geral','Os indicadores abaixo são calculados a partir dos seus dados reais.',button('Cadastrar cliente','add-client'))+`<div class="stats">${stat('Clientes',app.companies.length,'Máximo permitido: 100')}${stat('Clientes ativos',app.companies.filter(x=>x.active).length,'Contas habilitadas')}${stat('Filtros PNG',app.filters.length,'Arquivos cadastrados')}${stat('Boletos atrasados',overdue.length,brl(unpaid.reduce((sum,i)=>sum+Number(i.amount),0))+' a receber')}</div>`+`<div class="card"><h2>Próximos vencimentos</h2>${table(['CLIENTE','VENCIMENTO','VALOR','STATUS'],app.invoices.slice().filter(i=>i.status==='pending').sort((a,b)=>a.due_date.localeCompare(b.due_date)).slice(0,8).map(i=>`<tr><td><b>${escapeHtml(companyName(i.company_id))}</b></td><td>${dateBR(i.due_date)}</td><td>${brl(i.amount)}</td><td>${badge(dueStatus(i))}</td></tr>`).join(''))}</div>`}
function clients(){return header('GERENCIAMENTO','Clientes','Cada empresa terá seu próprio login e seus próprios filtros.',button('Novo cliente','add-client'))+`<div class="card">${table(['CLIENTE','SITUAÇÃO','MENSALIDADE','VENCIMENTO','AÇÕES'],app.companies.map(c=>`<tr><td><div class="company-admin-name"><span class="company-admin-logo">${brandImg(c,'company-admin-logo-img')||'<span>▣</span>'}</span><span><b>${escapeHtml(c.name)}</b><small>${escapeHtml(c.contact_email)}</small></span></div></td><td>${badge(c.active?'active':'inactive')}</td><td>${brl(c.monthly_fee)}</td><td>${dateBR(c.next_due_date)}</td><td><div class="actions">${action('edit-client',c.id,'Editar')}${action('reset-password',c.id,'Nova senha')}${action('remove-client',c.id,'Excluir','danger')}</div></td></tr>`).join(''))}</div>`}

function categoriesSection(){
  const rows=app.categories.map(c=>{
    const count=app.filters.filter(f=>f.category_id===c.id).length;
    return `<tr>
      <td><b>${escapeHtml(c.name)}</b></td>
      <td>${escapeHtml(companyName(c.company_id))}</td>
      <td><span class="category-count">${count} ${count===1?'filtro':'filtros'}</span></td>
      <td><div class="actions">
        ${action('edit-category',c.id,'Editar')}
        ${action('remove-category',c.id,'Excluir','danger')}
      </div></td>
    </tr>`;
  }).join('');
  return `<div class="card category-management">
    <div class="toolbar">
      <div><h2>Categorias</h2><p class="muted">Organize os filtros por assunto. Crie uma categoria aqui ou durante o envio de um PNG.</p></div>
      <button class="btn" type="button" data-act="add-category">＋ Nova categoria</button>
    </div>
    ${table(['CATEGORIA','EMPRESA','FILTROS','AÇÕES'],rows)}
  </div>`;
}
function filters(){
  return header('BIBLIOTECA','Filtros PNG','Gerencie categorias e envie os filtros de cada empresa em um só lugar.',button('Enviar PNG','add-filter'))+
    categoriesSection()+
    `<div class="card">
      <div class="toolbar"><div><h2>Filtros cadastrados</h2><p class="muted">Arquivos PNG transparentes organizados por empresa e categoria.</p></div></div>
      ${app.filters.length?`<div class="filters-grid">${app.filters.map(f=>`<div class="filter-card"><div class="filter-image"><img data-img="${f.id}" alt="Filtro ${escapeHtml(f.name)}"></div><b>${escapeHtml(f.name)}</b><small>${escapeHtml(companyName(f.company_id))} • ${escapeHtml(categoryName(f.category_id))}</small><div class="actions">${action('remove-filter',f.id,'Excluir','danger')}</div></div>`).join('')}</div>`:'<div class="empty">Nenhum filtro cadastrado. Envie seu primeiro PNG transparente.</div>'}
    </div>`;
}
function finance(){const pending=app.invoices.filter(x=>x.status==='pending'),paid=app.invoices.filter(x=>x.status==='paid'),late=pending.filter(x=>x.due_date<today());return header('COBRANÇAS','Financeiro','Controle manual de boletos; sem integração bancária automática.',button('Nova cobrança','add-invoice'))+`<div class="stats">${stat('A receber',brl(pending.reduce((s,x)=>s+Number(x.amount),0)),pending.length+' cobranças abertas')}${stat('Recebido',brl(paid.reduce((s,x)=>s+Number(x.amount),0)),paid.length+' pagamentos registrados')}${stat('Atrasado',brl(late.reduce((s,x)=>s+Number(x.amount),0)),late.length+' cobranças vencidas')}${stat('Empresas',app.companies.length,'Clientes cadastrados')}</div><div class="card">${table(['CLIENTE','VENCIMENTO','VALOR','STATUS','AÇÕES'],app.invoices.map(x=>`<tr><td><b>${escapeHtml(companyName(x.company_id))}</b></td><td>${dateBR(x.due_date)}</td><td>${brl(x.amount)}</td><td>${badge(dueStatus(x))}</td><td><div class="actions">${action('toggle-paid',x.id,x.status==='paid'?'Reabrir':'Marcar pago')}${action('edit-invoice',x.id,'Editar')}${action('remove-invoice',x.id,'Excluir','danger')}</div></td></tr>`).join(''))}</div>`}
function settings(){const branding=app.settings.branding||{};return header('PERSONALIZAÇÃO','Configurações','Altere o nome da plataforma e o WhatsApp de suporte.')+`<div class="card"><form id="settingsForm" class="form">${field('appName','Nome da plataforma',branding.appName||'Camera Marketing Studio')}${field('supportWhatsapp','WhatsApp de suporte',branding.supportWhatsapp||'', 'text',false)}<button type="submit" class="btn btn-primary">Salvar configurações</button></form><p class="note">O limite de 100 clientes é aplicado pelo banco. As senhas ficam no Supabase Auth e os PNGs em um armazenamento privado.</p></div>`}
function clientCategories(){
  return `<section class="client-home">
    <div class="client-home-heading">
      <div class="client-company-logo-wrap">
        ${brandImg(app.company,'client-company-logo')||'<span class="client-logo-fallback">FP</span>'}
      </div>
      <div class="client-home-heading-copy">
        <span class="client-eyebrow">BEM-VINDO À ${escapeHtml(app.company?.name||'SUA EMPRESA')}</span>
        <h1>Escolha uma categoria</h1>
        <p>Selecione o tema para abrir a câmera e criar seu conteúdo.</p>
      </div>
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
  const fromGallery=Boolean(app.galleryPhoto);
  return `<section class="client-camera-screen">
    <div class="client-viewfinder-wrap">
      <div class="camera-frame client-viewfinder">
        ${fromGallery
          ? `<img id="galleryBase" class="client-gallery-image" src="${escapeHtml(app.galleryPhoto.url)}" alt="Foto escolhida na galeria, recortada ao centro em formato Stories">`
          : '<video id="cameraVideo" autoplay playsinline muted></video>'}
        <img class="hidden" id="cameraOverlay" alt="Filtro sobre a foto">
        <button type="button" class="client-camera-menu-toggle" data-act="open-client-menu" aria-label="Abrir menu de categorias" aria-controls="clientCameraDrawer" aria-expanded="false"><span aria-hidden="true">☰</span></button>
        ${fromGallery?'<span class="client-gallery-indicator">FOTO DA GALERIA</span>':''}
      </div>
    </div>
    <div class="client-photo-controls">
      <button type="button" data-act="${fromGallery?'use-camera':'flip-camera'}" class="client-control-secondary" aria-label="${fromGallery?'Voltar para câmera':'Alternar câmera'}" title="${fromGallery?'Voltar para câmera':'Alternar câmera'}"><span class="client-control-icon">${fromGallery?'◉':'⟳'}</span><small>${fromGallery?'Câmera':'Alternar'}</small></button>
      <button type="button" data-act="capture" class="client-shutter" aria-label="${fromGallery?'Concluir foto e abrir opções de salvar e compartilhar':'Fotografar'}" title="${fromGallery?'Concluir foto e compartilhar':'Fotografar'}"><span></span></button>
      <button type="button" data-act="pick-gallery" class="client-control-secondary" aria-label="Escolher foto da galeria" title="Escolher foto da galeria"><span class="client-control-icon" aria-hidden="true"><svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m3 17 5.8-5.8 4.1 4.1 2.4-2.4L21 18"/></svg></span><small>Galeria</small></button>
      <input id="galleryPhotoInput" class="client-gallery-file-input" type="file" accept="image/*,.heic,.heif" aria-label="Escolher foto da galeria" tabindex="-1">
    </div>
    ${fromGallery?`<button type="button" class="client-gallery-finish" data-act="finish-gallery" aria-label="Concluir foto com filtro e abrir opções para salvar e compartilhar">
      <span class="client-gallery-finish-icon" aria-hidden="true">✓</span>
      <span class="client-gallery-finish-copy"><strong>Salvar ou compartilhar</strong><small>Concluir foto com o filtro selecionado</small></span>
      <span class="client-gallery-finish-arrow" aria-hidden="true">›</span>
    </button>`:''}
    <div class="client-filter-panel">
      <div class="client-filter-panel-top"><span>SELECIONE UM FILTRO</span><small>${filters.length} disponíveis</small></div>
      <div class="client-filter-strip" role="group" aria-label="Filtros disponíveis">
        ${filters.map(f=>`<button type="button" class="client-filter-choice ${app.selectedFilter===f.id?'active':''}" data-act="choose-filter" data-id="${escapeHtml(f.id)}" aria-label="Selecionar filtro ${escapeHtml(f.name)}" aria-pressed="${app.selectedFilter===f.id}">
          <span class="client-filter-circle"><img data-img="${escapeHtml(f.id)}" alt="" loading="lazy"></span>
          <span class="client-filter-name">${escapeHtml(f.name)}</span>
        </button>`).join('')||'<span class="client-empty-strip">Nenhum filtro nesta categoria.</span>'}
      </div>
    </div>
    <p class="client-save-note">${fromGallery?'Escolha outro filtro se quiser. Depois toque em Salvar ou compartilhar.':'Fotografe ou escolha uma foto da galeria. Resultado em 1080 × 1920.'}</p>
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
function render(){document.body.classList.remove('mobile-menu-lock','client-camera-menu-lock');if(!app.user){$('root').innerHTML=authMarkup(app.register);return;}if(!app.profile||app.profile.role!=='admin'&&!app.company){$('root').innerHTML=waiting();return;}const admin=app.profile.role==='admin';const content=admin?({dashboard,clients,filters,finance,settings}[app.page]||dashboard)():(app.page==='preview'&&app.captureData?previewView():app.page==='camera'&&app.selectedCategory?cameraView():clientCategories());$('root').innerHTML=layout(content);hydrateImages();hydrateBrandLogos();if(!admin&&app.page==='camera'&&app.selectedCategory){if(!app.galleryPhoto)startCamera();if(app.selectedFilter)selectFilter(app.selectedFilter);}}
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
function categoryModal(cid){
  const c=app.categories.find(x=>x.id===cid);
  const companyField=c
    ? `<div class="field"><label>Empresa</label><div class="category-company-locked">${escapeHtml(companyName(c.company_id))}</div><input type="hidden" name="company_id" value="${escapeHtml(c.company_id)}"></div>`
    : select('company_id','Empresa',companyOptions());
  openModal(c?'Editar categoria':'Nova categoria',
    `<form class="form" id="categoryForm">${companyField}${field('name','Categoria',c?.name||'')}${endForm}</form>`,'categoryForm');
  app.modal.recordId=c?.id||null;
}
function invoiceModal(iid){const i=app.invoices.find(x=>x.id===iid);openModal(i?'Editar cobrança':'Nova cobrança',`<form class="form" id="invoiceForm">${select('company_id','Empresa',companyOptions(i?.company_id))}${field('amount','Valor (R$)',i?.amount??0,'number')}${field('due_date','Vencimento',i?.due_date||today(),'date')}${select('status','Situação',option('pending','Pendente',!i||i.status==='pending')+option('paid','Pago',i?.status==='paid')+option('canceled','Cancelado',i?.status==='canceled'))}${field('notes','Observações',i?.notes||'','text',false)}${endForm}</form>`,'invoiceForm');app.modal.recordId=i?.id||null;}

function filterModal(){
  const content=`<form class="form" id="filterForm">
    ${select('company_id','Empresa',companyOptions())}
    <div class="field">
      <label for="filterCategory">Categoria</label>
      <select name="category_id" id="filterCategory" required></select>
    </div>
    <div class="field filter-new-category hidden" id="filterNewCategoryWrap">
      <label for="filterNewCategory">Nome da nova categoria</label>
      <input id="filterNewCategory" name="new_category_name" type="text" maxlength="100" placeholder="Ex.: Bom Dia, Ofertas, Financiamento">
      <span class="muted">A nova categoria ficará disponível para os próximos filtros desta empresa.</span>
    </div>
    ${field('name','Nome do filtro')}
    ${field('sort_order','Ordem',0,'number')}
    <div class="field"><label>PNG transparente (máximo 12 MB)</label><input type="file" name="file" accept="image/png,.png" required></div>
    <p class="muted">Recomendado: imagem vertical 1080 × 1920, com transparência real.</p>
    ${endForm}
  </form>`;
  openModal('Cadastrar filtro PNG',content,'filterForm');
  updateCategoryOptions();
}
function updateCategoryOptions(){
  const form=$('filterForm');if(!form)return;
  const companyId=form.elements.company_id.value;
  const target=$('filterCategory');
  if(!target)return;
  const previous=target.value;
  const existing=app.categories.filter(c=>c.company_id===companyId);
  target.innerHTML=existing.map(c=>option(c.id,c.name,c.id===previous)).join('')+
    option('__new__','＋ Criar nova categoria…',previous==='__new__'||!existing.length);
  if(previous&&[...target.options].some(o=>o.value===previous))target.value=previous;
  else if(!existing.length)target.value='__new__';
  updateNewCategoryField();
}
function updateNewCategoryField(){
  const form=$('filterForm');if(!form)return;
  const isNew=form.elements.category_id.value==='__new__';
  const wrap=$('filterNewCategoryWrap'),field=$('filterNewCategory');
  if(wrap)wrap.classList.toggle('hidden',!isNew);
  if(field){field.required=isNew;field.disabled=!isNew;}
}
async function validatePNG(file){if(!file||file.type!=='image/png'||file.size>12582912)throw Error('Selecione um PNG válido de até 12 MB.');const uri=URL.createObjectURL(file);try{const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('PNG não reconhecido.'));img.src=uri;});const canvas=document.createElement('canvas');canvas.width=100;canvas.height=178;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,100,178);const pixels=ctx.getImageData(0,0,100,178).data;let transparent=false,visible=false;for(let i=3;i<pixels.length;i+=4){if(pixels[i]<240)transparent=true;if(pixels[i]>15)visible=true;if(transparent&&visible)break;}if(!transparent||!visible)throw Error('O filtro precisa ter elementos visíveis e fundo transparente.');}finally{URL.revokeObjectURL(uri);}}

async function filterUpload(form){
  const file=form.elements.file.files[0];
  await validatePNG(file);
  const companyId=form.elements.company_id.value;
  let categoryId=form.elements.category_id.value;
  if(!app.companies.some(c=>c.id===companyId))throw Error('Selecione uma empresa válida.');
  let createdCategoryId=null;
  let path=null;
  try{
    if(categoryId==='__new__'){
      const name=form.elements.new_category_name.value.trim();
      if(!name||name.length>100)throw Error('Informe o nome da nova categoria (até 100 caracteres).');
      // Nunca criar categoria em empresa diferente daquela escolhida para o PNG.
      const {data,error}=await api.from('categories')
        .insert({company_id:companyId,name})
        .select('id').single();
      if(error)throw error;
      createdCategoryId=data.id;
      categoryId=data.id;
    }else if(!app.categories.some(c=>c.id===categoryId&&c.company_id===companyId)){
      throw Error('Escolha uma categoria válida para esta empresa.');
    }
    path=`${companyId}/${id()}.png`;
    const {error:uploadError}=await api.storage.from('company-filters')
      .upload(path,file,{contentType:'image/png',upsert:false});
    if(uploadError)throw uploadError;
    const payload={company_id:companyId,category_id:categoryId,
      name:form.elements.name.value.trim(),sort_order:Number(form.elements.sort_order.value),storage_path:path};
    const {error}=await api.from('filters').insert(payload);
    if(error)throw error;
  }catch(error){
    if(path)await api.storage.from('company-filters').remove([path]);
    if(createdCategoryId){
      // O envio falhou. Remover apenas a categoria recém-criada e vazia.
      const {count}=await api.from('filters').select('id',{count:'exact',head:true}).eq('category_id',createdCategoryId);
      if(count===0)await api.from('categories').delete().eq('id',createdCategoryId);
    }
    throw error;
  }
}
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
async function startCamera(facing='environment'){
  const video=$('cameraVideo');
  if(!video||app.galleryPhoto)return;
  stopCamera();
  const requestId=app.cameraRequestId;
  try{
    const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:facing},width:{ideal:1920},height:{ideal:1080}}});
    // Ao escolher uma foto da galeria ou sair da tela, descartar solicitações de câmera pendentes.
    if(requestId!==app.cameraRequestId||!video.isConnected||app.galleryPhoto||app.page!=='camera'){
      stream.getTracks().forEach(t=>t.stop());
      return;
    }
    app.stream=stream;video.srcObject=stream;await video.play();app.facing=facing;
  }catch(error){
    if(requestId===app.cameraRequestId&&app.page==='camera'&&!app.galleryPhoto)
      toast('Autorize a câmera no Safari ou Chrome. '+errorMessage(error));
  }
}
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


function drawSourceCover(ctx,source,width,height){
  const sw=source.videoWidth||source.naturalWidth;
  const sh=source.videoHeight||source.naturalHeight;
  if(!sw||!sh)throw new Error('Não foi possível ler as dimensões da imagem.');
  // Equivalent to object-fit: cover; object-position: center, for all orientations.
  const scale=Math.max(width/sw,height/sh);
  const cropW=width/scale,cropH=height/scale;
  const sx=(sw-cropW)/2,sy=(sh-cropH)/2;
  ctx.drawImage(source,sx,sy,cropW,cropH,0,0,width,height);
}
async function loadGalleryPhoto(file){
  if(!file)return;
  if(app.processing)return toast('Aguarde a geração da imagem anterior.');
  if(!(typeof file.type==='string'&&file.type.startsWith('image/'))&&!/\.(?:jpe?g|png|webp|heic|heif)$/i.test(file.name||''))
    return toast('Escolha uma foto válida da galeria.');
  if(file.size>25*1024*1024)return toast('A foto deve ter até 25 MB.');
  const uri=URL.createObjectURL(file);
  const img=new Image();
  try{
    await new Promise((resolve,reject)=>{
      img.onload=resolve;
      img.onerror=()=>reject(new Error('Não foi possível abrir esta foto. Tente JPEG ou PNG.'));
      img.src=uri;
    });
    if(!img.naturalWidth||!img.naturalHeight)throw new Error('A imagem selecionada está vazia.');
    if(app.page!=='camera'||!app.user){URL.revokeObjectURL(uri);return;}
    stopCamera();
    clearGalleryPhoto();
    app.galleryPhoto={url:uri,img,file};
    render();
    window.scrollTo(0,0);
    toast('Foto carregada! Troque o filtro se quiser e toque em Salvar ou compartilhar.');
  }catch(error){
    URL.revokeObjectURL(uri);
    toast(errorMessage(error));
  }
}
async function capture(){
  if(app.processing)return;
  const gallery=app.galleryPhoto;
  const video=$('cameraVideo');
  if(!app.selectedFilter)return toast('Selecione um filtro.');
  if(!gallery&&(!video||!video.videoWidth||!app.stream))
    return toast('Ative a câmera ou escolha uma foto da galeria.');
  const filter=app.filters.find(f=>f.id===app.selectedFilter);
  if(!filter)return;
  app.processing=true;
  const shutter=document.querySelector('[data-act="capture"]');
  const finishButton=document.querySelector('[data-act="finish-gallery"]');
  if(shutter)shutter.disabled=true;
  if(finishButton){
    finishButton.disabled=true;
    finishButton.setAttribute('aria-busy','true');
    const title=finishButton.querySelector('strong');
    if(title)title.textContent='Preparando sua foto...';
  }
  try{
    const src=await mediaUrl(filter);
    const overlay=new Image();
    overlay.src=src;
    await new Promise((resolve,reject)=>{
      if(overlay.complete&&overlay.naturalWidth>0){resolve();return;}
      overlay.onload=resolve;overlay.onerror=()=>reject(new Error('Não foi possível aplicar o PNG ao resultado.'));
    });
    const source=gallery?gallery.img:video;
    if(!gallery&&(!video.videoWidth||!app.stream))throw new Error('A câmera parou. Ative-a novamente.');
    if(gallery&&!gallery.img.naturalWidth)throw new Error('Reabra a foto da galeria.');
    const canvas=document.createElement('canvas');
    canvas.width=1080;canvas.height=1920;
    const ctx=canvas.getContext('2d');
    if(!ctx)throw new Error('Não foi possível preparar a fotografia.');
    drawSourceCover(ctx,source,1080,1920);
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
  finally{
    app.processing=false;
    if(shutter?.isConnected)shutter.disabled=false;
    if(finishButton?.isConnected){
      finishButton.disabled=false;
      finishButton.removeAttribute('aria-busy');
      const title=finishButton.querySelector('strong');
      if(title)title.textContent='Salvar ou compartilhar';
    }
  }
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

async function click(event){const target=event.target.closest('[data-act],[data-nav]');if(!target)return;if(target.dataset.nav){navigate(target.dataset.nav);return;}const act=target.dataset.act,uid=target.dataset.id;try{if(act==='login-view'||act==='register-view'){app.register=act==='register-view';render();return;}if(act==='open-mobile-menu'){setAdminMobileMenu(true);return;}if(act==='close-mobile-menu'){setAdminMobileMenu(false);return;}if(act==='open-client-menu'){setClientCameraMenu(true);return;}if(act==='close-client-menu'){setClientCameraMenu(false);return;}if(act==='client-switch-category'){
  if(app.selectedCategory===uid){setClientCameraMenu(false);return;}
  const next=app.categories.find(c=>c.id===uid);
  if(!next)return;
  clearGalleryPhoto();
  stopCamera();
  app.selectedCategory=uid;
  app.selectedFilter=app.filters.find(f=>f.category_id===uid&&f.active)?.id||null;
  app.page='camera';render();window.scrollTo(0,0);return;
}if(act==='logout'){stopCamera();clearCapturedPhoto();clearGalleryPhoto();app.images.forEach(v=>URL.revokeObjectURL(v));app.images.clear();await api.auth.signOut();app.user=null;app.profile=null;app.company=null;app.modal=null;render();return;}if(act==='close-modal'){closeModal();return;}if(act==='add-client'||act==='edit-client'){companyModal(act==='edit-client'?uid:null);return;}if(act==='add-category'||act==='edit-category'){categoryModal(act==='edit-category'?uid:null);return;}if(act==='add-invoice'||act==='edit-invoice'){invoiceModal(act==='edit-invoice'?uid:null);return;}if(act==='add-filter'){filterModal();return;}if(act==='reset-password'){openModal('Alterar senha do cliente',`<form class="form" id="passwordForm">${field('password','Nova senha (mínimo 8 caracteres)','','password',true,8)}${endForm}</form>`,'passwordForm');app.modal.recordId=uid;render();return;}if(act==='remove-client'){if(confirm('Excluir a empresa, seu login, categorias e PNGs? Esta ação é irreversível.')){await manager({action:'delete',company_id:uid});await refresh();}return;}if(act==='remove-category'){if(confirm('Excluir esta categoria? Os filtros vinculados também serão excluídos.')){
  const paths=app.filters.filter(f=>f.category_id===uid).map(f=>f.storage_path).filter(Boolean);
  const {error}=await api.from('categories').delete().eq('id',uid);
  if(error)throw error;
  if(paths.length){const {error:storageError}=await api.storage.from('company-filters').remove(paths);
    if(storageError)toast('Categoria removida, mas alguns PNGs precisam de limpeza no armazenamento.');
  }
  await refresh();
}return;}if(act==='remove-filter'){if(confirm('Excluir este filtro permanentemente?')){const filter=app.filters.find(f=>f.id===uid);if(!filter)return;const {error}=await api.from('filters').delete().eq('id',uid);if(error)throw error;const removed=await api.storage.from('company-filters').remove([filter.storage_path]);if(removed.error)toast('Cadastro removido, mas o PNG precisa de limpeza no Storage.');await refresh();}return;}if(act==='remove-invoice'){if(confirm('Excluir esta cobrança?')){const {error}=await api.from('invoices').delete().eq('id',uid);if(error)throw error;await refresh();}return;}if(act==='toggle-paid'){const invoice=app.invoices.find(i=>i.id===uid);const paid=invoice.status!=='paid';const {error}=await api.from('invoices').update({status:paid?'paid':'pending',paid_at:paid?new Date().toISOString():null}).eq('id',uid);if(error)throw error;await refresh();return;}if(act==='open-category'){clearGalleryPhoto();app.selectedCategory=uid;app.selectedFilter=app.filters.find(f=>f.category_id===uid&&f.active)?.id||null;app.page='camera';render();return;}if(act==='back-categories'){navigate('categories');return;}if(act==='choose-filter'){selectFilter(uid);return;}if(act==='activate-camera'){await startCamera();return;}if(act==='flip-camera'){await startCamera(app.facing==='user'?'environment':'user');return;}if(act==='use-camera'){clearGalleryPhoto();render();return;}if(act==='pick-gallery'){$('galleryPhotoInput')?.click();return;}if(act==='capture'||act==='finish-gallery'){capture();return;}if(act==='photo-share'){shareCapturedPhoto();return;}if(act==='photo-instagram'){shareCapturedPhoto('instagram');return;}if(act==='photo-whatsapp'){shareCapturedPhoto('whatsapp');return;}if(act==='photo-save'){saveCapturedPhoto();return;}if(act==='photo-retake'){backToCamera(false);return;}if(act==='photo-change-filter'){backToCamera(true);return;}}catch(error){toast(errorMessage(error));}}
function setClientCameraMenu(open){
  const root=document.querySelector('.client-app.is-camera');
  const drawer=$('clientCameraDrawer');
  if(!root||!drawer)return;
  root.classList.toggle('client-camera-menu-open',open);
  drawer.inert=!open;
  drawer.setAttribute('aria-hidden',String(!open));
  const toggle=document.querySelector('.client-camera-menu-toggle');
  toggle?.setAttribute('aria-expanded',String(open));
  document.body.classList.toggle('client-camera-menu-lock',open);
  if(open)drawer.querySelector('.client-camera-drawer-close')?.focus();
  else toggle?.focus();
}
function setAdminMobileMenu(open){
  const layout=$('adminLayout'),button=document.querySelector('.mobile-menu-toggle');
  if(!layout)return;
  layout.classList.toggle('admin-menu-open',open);
  button?.setAttribute('aria-expanded',String(open));
  document.body.classList.toggle('mobile-menu-lock',open&&window.matchMedia('(max-width:700px)').matches);
  if(open)document.querySelector('.sidebar-close')?.focus();
  else if(!document.querySelector('.overlay'))button?.focus();
}
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&$('adminLayout')?.classList.contains('admin-menu-open'))setAdminMobileMenu(false);
  if(event.key==='Escape'&&document.querySelector('.client-camera-menu-open'))setClientCameraMenu(false);
});
window.addEventListener('resize',()=>{
  if(window.innerWidth>700&&$('adminLayout')?.classList.contains('admin-menu-open'))setAdminMobileMenu(false);
});

$('root').addEventListener('click',click);
$('root').addEventListener('submit',handleForm);
$('root').addEventListener('change',event=>{if(app.modal?.formId==='filterForm'){if(event.target.id==='f_company_id')updateCategoryOptions();if(event.target.id==='filterCategory')updateNewCategoryField();}if(event.target.id==='galleryPhotoInput'){const file=event.target.files?.[0];event.target.value='';if(file)loadGalleryPhoto(file);}});
init();
