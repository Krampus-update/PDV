import UsuarioModel from '../models/UsuarioModel.js';
import {
  listTenants,
  registerTenant,
  deleteTenant,
  runWithTenant,
  initializeTenantDatabase,
  sanitizeTenantCode
} from '../database/database.js';
import {
  getMaintenanceStatus,
  installAutostart,
  removeAutostart,
  resetTenantDatabase
} from '../services/devToolsService.js';

async function status(req, res, next) {
  try {
    const data = await getMaintenanceStatus(req.tenantCode);
    res.json(data);
  } catch (error) {
    next(error);
  }
}

async function resetDb(req, res, next) {
  try {
    const data = await resetTenantDatabase(req.tenantCode);
    res.json({ ok: true, ...data });
  } catch (error) {
    next(error);
  }
}

async function autostartInstall(req, res, next) {
  try {
    const data = await installAutostart();
    res.json({ ok: true, ...data });
  } catch (error) {
    next(error);
  }
}

async function autostartRemove(req, res, next) {
  try {
    const data = await removeAutostart();
    res.json({ ok: true, ...data });
  } catch (error) {
    next(error);
  }
}

async function tenantsList(req, res, next) {
  try {
    const tenants = await listTenants();
    res.json(tenants);
  } catch (error) {
    next(error);
  }
}

async function tenantsCreate(req, res, next) {
  try {
    const { code, nome, gerente_nome, gerente_login, gerente_senha } = req.body || {};
    if (!code || !gerente_nome || !gerente_login || !gerente_senha) {
      return res.status(400).json({
        error: 'code, gerente_nome, gerente_login e gerente_senha são obrigatórios'
      });
    }
    const tenantCode = sanitizeTenantCode(code);
    await registerTenant({ code: tenantCode, nome: nome || tenantCode });
    await initializeTenantDatabase(tenantCode);
    const usuario = await runWithTenant(tenantCode, async () => {
      const id = await UsuarioModel.criarUsuario({
        nome: gerente_nome,
        login: gerente_login,
        senha: gerente_senha,
        role: 'gerente'
      });
      return UsuarioModel.obterPorId(id);
    });
    res.status(201).json({ ok: true, tenant: tenantCode, usuario });
  } catch (error) {
    next(error);
  }
}

async function tenantsDelete(req, res, next) {
  try {
    const code = sanitizeTenantCode(req.params.code);
    const deleted = await deleteTenant(code);
    res.json({ ok: true, tenant: deleted, deletedCurrent: String(req.tenantCode || '') === deleted });
  } catch (error) {
    next(error);
  }
}

export default {
  status,
  resetDb,
  autostartInstall,
  autostartRemove,
  tenantsList,
  tenantsCreate,
  tenantsDelete
};
