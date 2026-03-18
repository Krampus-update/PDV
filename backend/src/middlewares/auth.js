import { DEV_LOGIN } from '../services/devAccessService.js';
import UsuarioModel from '../models/UsuarioModel.js';
import { runWithTenant, sanitizeTenantCode } from '../database/database.js';

const ROLE_LEVEL = {
  funcionario: 1,
  gerente: 2,
  dev: 3,
  admin: 2
};

function normalizeRole(role) {
  const r = String(role || '').toLowerCase();
  if (r === 'admin') return 'gerente';
  if (r === 'cliente' || r === 'cozinha') return 'funcionario';
  return r;
}

function hasRoleAccess(userRole, requiredRole) {
  const userLvl = ROLE_LEVEL[normalizeRole(userRole)] || 0;
  const reqLvl = ROLE_LEVEL[normalizeRole(requiredRole)] || 0;
  return userLvl >= reqLvl;
}

async function authOptional(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;
    if (!token) return next();
    const rawTenant = req.headers['x-tenant-code'] || req.body?.restaurante || req.body?.restaurante_codigo || req.query?.restaurante;
    const tenantCode = rawTenant ? sanitizeTenantCode(rawTenant) : null;
    const sessao = tenantCode
      ? await runWithTenant(tenantCode, () => UsuarioModel.obterSessaoValida(token))
      : await UsuarioModel.obterSessaoValida(token);
    if (sessao) {
      const role = sessao.login === DEV_LOGIN ? 'dev' : normalizeRole(sessao.role);
      req.user = {
        id: sessao.usuario_id,
        nome: sessao.nome,
        login: sessao.login,
        role,
        is_dev: role === 'dev' || sessao.login === DEV_LOGIN
      };
      req.sessionToken = token;
      req.sessionExpiresAt = sessao.expires_at;
      if (tenantCode) req.tenantCode = tenantCode;
    }
    next();
  } catch (error) {
    next(error);
  }
}

function authRequired(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Autenticação obrigatória' });
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Autenticação obrigatória' });
    if (req.user.is_dev) return next();
    const ok = roles.some((r) => hasRoleAccess(req.user.role, r));
    if (!ok) {
      return res.status(403).json({ error: 'Permissão insuficiente' });
    }
    next();
  };
}

export { authOptional, authRequired, requireRole, normalizeRole, hasRoleAccess };
