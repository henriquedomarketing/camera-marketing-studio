// Supabase Edge Function: server-side user management, JWT verified by the gateway.
// Secret credentials must remain in Supabase server environment only.
import { createClient } from 'npm:@supabase/supabase-js@2.57.0';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,x-client-info,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json; charset=utf-8'};
const respond=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
const clean=(v:unknown,max=120)=>typeof v==='string'?v.trim().slice(0,max):'';
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return respond({error:'Método não permitido'},405);
 const url=Deno.env.get('SUPABASE_URL'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!service)return respond({error:'Serviço não configurado'},503);
 const sb=createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}});
 const header=req.headers.get('authorization')||'',token=header.startsWith('Bearer ')?header.slice(7):'';
 if(!token)return respond({error:'Autenticação necessária'},401);
 const {data:auth,error:authError}=await sb.auth.getUser(token);
 if(authError||!auth.user)return respond({error:'Sessão inválida'},401);
 const {data:profile}=await sb.from('profiles').select('role').eq('id',auth.user.id).maybeSingle();
 if(profile?.role!=='admin')return respond({error:'Somente administradores'},403);
 let b:Record<string,unknown>;
 try{b=await req.json()}catch{return respond({error:'JSON inválido'},400)}
 const action=clean(b.action,30),companyId=clean(b.company_id,50),name=clean(b.name),email=clean(b.email,160).toLowerCase(),password=typeof b.password==='string'?b.password:'';
 if(action==='create'){
  if(name.length<2||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||password.length<8||password.length>128)return respond({error:'Empresa, e-mail ou senha inválida'},400);
  const monthlyFee=Number(b.monthly_fee??0),dueDay=Number(b.due_day??10);
  if(!Number.isFinite(monthlyFee)||monthlyFee<0||monthlyFee>100000||!Number.isInteger(dueDay)||dueDay<1||dueDay>31)return respond({error:'Valores inválidos'},400);
  const {data:company,error:ce}=await sb.from('companies').insert({name,contact_email:email,phone:clean(b.phone,50),monthly_fee:monthlyFee,due_day:dueDay,next_due_date:b.next_due_date||null}).select('id').single();
  if(ce||!company)return respond({error:ce?.message||'Falha ao criar empresa'},400);
  const {data:user,error:ue}=await sb.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{display_name:name}});
  if(ue||!user.user){await sb.from('companies').delete().eq('id',company.id);return respond({error:ue?.message||'Falha ao criar usuário'},400)}
  const {error:le}=await sb.from('profiles').update({role:'client',company_id:company.id,display_name:name}).eq('id',user.user.id);
  if(le){await sb.auth.admin.deleteUser(user.user.id);await sb.from('companies').delete().eq('id',company.id);return respond({error:'Falha ao vincular login'},500)}
  return respond({ok:true,company_id:company.id,email});
 }
 if(action==='reset_password'){
  if(!companyId||password.length<8||password.length>128)return respond({error:'Dados inválidos'},400);
  const {data:p}=await sb.from('profiles').select('id').eq('company_id',companyId).eq('role','client').maybeSingle();
  if(!p)return respond({error:'Cliente não encontrado'},404);
  const {error}=await sb.auth.admin.updateUserById(p.id,{password});
  return error?respond({error:'Não foi possível alterar a senha'},400):respond({ok:true});
 }
 if(action==='delete'){
  if(!companyId)return respond({error:'Empresa obrigatória'},400);
  const {data:found}=await sb.from('companies').select('id').eq('id',companyId).maybeSingle();if(!found)return respond({error:'Não encontrado'},404);
  const {data:files}=await sb.from('filters').select('storage_path').eq('company_id',companyId);
  const paths=(files||[]).map(x=>x.storage_path).filter(Boolean);
  if(paths.length){const {error}=await sb.storage.from('company-filters').remove(paths);if(error)return respond({error:'Falha ao excluir arquivos'},500)}
  const {data:users}=await sb.from('profiles').select('id').eq('company_id',companyId).eq('role','client');
  for(const u of users||[]){const {error}=await sb.auth.admin.deleteUser(u.id);if(error)return respond({error:'Falha ao excluir login'},500)}
  const {error}=await sb.from('companies').delete().eq('id',companyId);
  return error?respond({error:'Falha ao excluir empresa'},500):respond({ok:true});
 }
 return respond({error:'Ação desconhecida'},400);
});
