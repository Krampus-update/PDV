import { sanitizeTenantCode, tenantExists, initializeTenantDatabase, runWithTenant } from '../database/database.js';

const PUBLIC_WITHOUT_TENANT = new Set(['/', '/status']);

function isPublicDevPath(pathname) {
  return pathname === '/dev' || pathname.startsWith('/dev/');
}

function isAuthPath(pathname, target) {
  return pathname === `/auth/${target}`;
}

async function tenantMiddleware(req, res, next) {
  try {
    const pathname = req.path || '';
    if (PUBLIC_WITHOUT_TENANT.has(pathname) || isPublicDevPath(pathname)) {
      return next();
    }

    const bodyTenant = req.body?.restaurante || req.body?.restaurante_codigo;
    const headerTenant = req.headers['x-tenant-code'];
    const queryTenant = req.query?.restaurante;
    const rawTenant = bodyTenant || headerTenant || queryTenant;

    if (!rawTenant) {
      return res.status(400).json({ error: 'Restaurante é obrigatório (x-tenant-code ou campo restaurante)' });
    }

    let tenantCode;
    try {
      tenantCode = sanitizeTenantCode(rawTenant);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }

    const isRegister = isAuthPath(pathname, 'registrar');
    if (!isRegister) {
      const exists = await tenantExists(tenantCode);
      if (!exists) {
        return res.status(404).json({ error: 'Restaurante não encontrado' });
      }
      await initializeTenantDatabase(tenantCode);
    }

    req.tenantCode = tenantCode;
    return runWithTenant(tenantCode, () => next());
  } catch (error) {
    next(error);
  }
}

export { tenantMiddleware };
