import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });
const safeText = (value: unknown, max = 120) => typeof value === "string" ? value.trim().slice(0, max) : "";
const validEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return json({ error: "Configuração protegida do servidor ausente." }, 503);
  const adminApi = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const authorization = req.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return json({ error: "Faça login para continuar." }, 401);
  const { data: authData, error: authError } = await adminApi.auth.getUser(token);
  if (authError || !authData.user) return json({ error: "Sessão inválida." }, 401);
  const { data: profile, error: profileError } = await adminApi.from("profiles").select("role").eq("id", authData.user.id).maybeSingle();
  if (profileError || profile?.role !== "admin") return json({ error: "Acesso exclusivo do administrador." }, 403);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Dados inválidos." }, 400); }
  const action = safeText(body.action, 32);
  const companyId = safeText(body.company_id, 50);
  const password = typeof body.password === "string" ? body.password : "";
  const name = safeText(body.name, 120);
  const email = safeText(body.email, 160).toLowerCase();

  if (action === "create") {
    if (!name || name.length < 2 || !validEmail(email) || password.length < 8 || password.length > 128) {
      return json({ error: "Preencha empresa, e-mail válido e senha de 8 a 128 caracteres." }, 400);
    }
    const monthlyFee = Number(body.monthly_fee ?? 0);
    const dueDay = Number(body.due_day ?? 10);
    if (!Number.isFinite(monthlyFee) || monthlyFee < 0 || monthlyFee > 100000 || !Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31)
      return json({ error: "Valor ou dia do vencimento inválido." }, 400);
    const { data: createdCompany, error: companyError } = await adminApi.from("companies").insert({
      name, contact_email: email, phone: safeText(body.phone, 50),
      monthly_fee: monthlyFee, due_day: dueDay, next_due_date: body.next_due_date || null
    }).select("id").single();
    if (companyError || !createdCompany) return json({ error: companyError?.message || "Não foi possível criar a empresa." }, 400);
    const { data: createdUser, error: userError } = await adminApi.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { display_name: name }
    });
    if (userError || !createdUser.user) {
      await adminApi.from("companies").delete().eq("id", createdCompany.id);
      return json({ error: userError?.message || "Não foi possível criar o login." }, 400);
    }
    const { error: linkError } = await adminApi.from("profiles")
      .update({ role: "client", company_id: createdCompany.id, display_name: name })
      .eq("id", createdUser.user.id);
    if (linkError) {
      await adminApi.auth.admin.deleteUser(createdUser.user.id);
      await adminApi.from("companies").delete().eq("id", createdCompany.id);
      return json({ error: "Erro ao associar login à empresa." }, 500);
    }
    return json({ ok: true, company_id: createdCompany.id, email });
  }

  if (action === "reset_password") {
    if (!companyId || password.length < 8 || password.length > 128)
      return json({ error: "Informe a empresa e uma senha de 8 a 128 caracteres." }, 400);
    const { data: profileRow } = await adminApi.from("profiles").select("id")
      .eq("company_id", companyId).eq("role", "client").maybeSingle();
    if (!profileRow) return json({ error: "Login do cliente não encontrado." }, 404);
    const { error } = await adminApi.auth.admin.updateUserById(profileRow.id, { password });
    if (error) return json({ error: "Não foi possível alterar a senha." }, 400);
    return json({ ok: true });
  }

  if (action === "delete") {
    if (!companyId) return json({ error: "Informe a empresa." }, 400);
    const { data: exists } = await adminApi.from("companies").select("id,logo_path").eq("id", companyId).maybeSingle();
    if (!exists) return json({ error: "Empresa não encontrada." }, 404);
    const { data: filterRows } = await adminApi.from("filters").select("storage_path").eq("company_id", companyId);
    const paths = (filterRows || []).map((row) => row.storage_path).filter(Boolean);
    // O arquivo de identidade visual fica na mesma pasta privada da empresa.
    if (exists.logo_path) paths.push(exists.logo_path);
    if (paths.length) {
      const { error: storageError } = await adminApi.storage.from("company-filters").remove(paths);
      if (storageError) return json({ error: "Erro ao limpar PNGs. A empresa não foi excluída." }, 500);
    }
    const { data: loginRows } = await adminApi.from("profiles").select("id")
      .eq("company_id", companyId).eq("role", "client");
    for (const login of loginRows || []) {
      const { error: deleteAuthError } = await adminApi.auth.admin.deleteUser(login.id);
      if (deleteAuthError) return json({ error: "Falha ao excluir o login. Revise a empresa antes de tentar novamente." }, 500);
    }
    const { error: deleteError } = await adminApi.from("companies").delete().eq("id", companyId);
    if (deleteError) return json({ error: "Falha ao excluir empresa. Verifique o painel." }, 500);
    return json({ ok: true });
  }

  return json({ error: "Ação desconhecida." }, 400);
});