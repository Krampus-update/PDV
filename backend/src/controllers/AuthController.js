import { DEV_LOGIN, getDevPassword } from '../services/devAccessService.js';
import UsuarioModel from '../models/UsuarioModel.js';
import HistoricoModel from '../models/HistoricoModel.js';
import {
  registerTenant,
  tenantExists,
  initializeTenantDatabase,
  runWithTenant,
  sanitizeTenantCode
} from '../database/database.js';
import { normalizeRole, hasRoleAccess } from '../middlewares/auth.js';

function canManageRole(actor, targetRole) {
  const actorRole = normalizeRole(actor?.role || 'funcionario');
  const role = normalizeRole(targetRole);
  if (actor?.is_dev) return ['dev', 'gerente', 'funcionario'].includes(role);
  if (actorRole === 'gerente') return role === 'funcionario';
  return false;
}

function canManageUser(actor, targetUser) {
  if (!actor || !targetUser) return false;
  if (actor.is_dev) return true;
  const actorRole = normalizeRole(actor.role);
  const targetRole = normalizeRole(targetUser.role);
  if (actorRole !== 'gerente') return false;
  return targetRole === 'funcionario';
}

class AuthController {
  static async registrar(req, res) {
    try {
      const {
        restaurante_codigo,
        restaurante_nome,
        nome,
        login,
        senha
      } = req.body;

      if (!restaurante_codigo || !nome || !login || !senha) {
        return res.status(400).json({
          error: 'restaurante_codigo, nome, login e senha são obrigatórios'
        });
      }

      const tenantCode = sanitizeTenantCode(restaurante_codigo);

      await registerTenant({
        code: tenantCode,
        nome: restaurante_nome || tenantCode
      });

      await initializeTenantDatabase(tenantCode);

      const usuario = await runWithTenant(tenantCode, async () => {
        const existente = await UsuarioModel.obterPorLogin(login);
        if (existente) {
          throw new Error('Login já cadastrado neste restaurante');
        }
        const id = await UsuarioModel.criarUsuario({
          nome,
          login,
          senha,
          role: 'gerente'
        });
        return UsuarioModel.obterPorId(id);
      });

      res.status(201).json({
        message: 'Restaurante e conta criados com sucesso',
        restaurante: tenantCode,
        usuario
      });
    } catch (error) {
      console.error('Erro no cadastro de restaurante:', error);
      if (error.message === 'Restaurante já existe' || error.message.includes('já cadastrado')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  }

  static async login(req, res) {
    try {
      const { restaurante, login, senha } = req.body;
      if (!restaurante || !login || !senha) {
        return res.status(400).json({ error: 'restaurante, login e senha são obrigatórios' });
      }

      const tenantCode = sanitizeTenantCode(restaurante);
      const tenant = await tenantExists(tenantCode);
      if (!tenant) {
        return res.status(404).json({ error: 'Restaurante não encontrado' });
      }

      await initializeTenantDatabase(tenantCode);

      const resultado = await runWithTenant(tenantCode, async () => {
        if (login === DEV_LOGIN) {
          const devPassword = await getDevPassword();
          if (senha !== devPassword) return null;

          let devUser = await UsuarioModel.obterPorLoginQualquerStatus(DEV_LOGIN);
          if (!devUser) {
            const devId = await UsuarioModel.criarUsuario({
              nome: 'Desenvolvedor',
              login: DEV_LOGIN,
              senha: devPassword,
              role: 'dev'
            });
            devUser = await UsuarioModel.obterPorLoginQualquerStatus(DEV_LOGIN);
            if (!devUser && devId) {
              devUser = { id: devId, nome: 'Desenvolvedor', login: DEV_LOGIN, role: 'dev', ativo: 1 };
            }
          } else if (normalizeRole(devUser.role) !== 'dev' || Number(devUser.ativo || 0) !== 1) {
            await UsuarioModel.atualizarUsuario(devUser.id, { role: 'dev', ativo: true, senha: devPassword });
            devUser = await UsuarioModel.obterPorLoginQualquerStatus(DEV_LOGIN);
          }

          await UsuarioModel.limparSessoesExpiradas();
          const sessao = await UsuarioModel.criarSessao(devUser.id, 24);
          return {
            sessao,
            usuario: {
              id: devUser.id,
              nome: devUser.nome,
              login: DEV_LOGIN,
              role: 'dev',
              dev: true
            }
          };
        }

        const usuario = await UsuarioModel.obterPorLogin(login);
        if (!usuario) return null;

        const hash = UsuarioModel.hashSenha(senha);
        if (hash !== usuario.senha_hash) return null;

        await UsuarioModel.limparSessoesExpiradas();
        const sessao = await UsuarioModel.criarSessao(usuario.id, 12);

        try {
          await HistoricoModel.registrar({
            tipo_entidade: 'auth',
            entidade_id: usuario.id,
            acao: 'login_sucesso',
            detalhes: { login: usuario.login, role: normalizeRole(usuario.role) }
          });
        } catch {
          // não bloquear login por histórico
        }

        return {
          sessao,
          usuario: {
            id: usuario.id,
            nome: usuario.nome,
            login: usuario.login,
            role: normalizeRole(usuario.role)
          }
        };
      });

      if (!resultado) {
        return res.status(401).json({ error: 'Credenciais inválidas' });
      }

      res.json({
        token: resultado.sessao.token,
        expires_at: resultado.sessao.expires_at,
        restaurante: tenantCode,
        usuario: resultado.usuario
      });
    } catch (error) {
      console.error('Erro no login:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async me(req, res) {
    if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
    res.json({
      usuario: req.user,
      restaurante: req.tenantCode,
      session: {
        token: req.sessionToken || null,
        expires_at: req.sessionExpiresAt || null
      }
    });
  }

  static async refresh(req, res) {
    try {
      if (!req.user || !req.sessionToken) {
        return res.status(401).json({ error: 'Não autenticado' });
      }
      const refreshHoras = req.user.is_dev ? 24 : 12;
      const sessao = await UsuarioModel.renovarSessao(req.sessionToken, refreshHoras);
      if (!sessao) {
        return res.status(401).json({ error: 'Sessão inválida' });
      }
      res.json({ message: 'Sessão renovada', expires_at: sessao.expires_at });
    } catch (error) {
      console.error('Erro ao renovar sessão:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async logout(req, res) {
    try {
      const auth = req.headers.authorization || '';
      const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;
      if (token) await UsuarioModel.removerSessao(token);
      res.json({ message: 'Logout realizado' });
    } catch (error) {
      console.error('Erro no logout:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async listarUsuarios(req, res) {
    try {
      if (!hasRoleAccess(req.user.role, 'gerente')) {
        return res.status(403).json({ error: 'Permissão insuficiente' });
      }
      const usuarios = await UsuarioModel.listarUsuarios();
      res.json(usuarios.map((u) => ({ ...u, role: normalizeRole(u.role) })));
    } catch (error) {
      console.error('Erro ao listar usuários:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async criarUsuario(req, res) {
    try {
      const { nome, login, senha, role = 'funcionario' } = req.body;
      if (!nome || !login || !senha) {
        return res.status(400).json({ error: 'nome, login e senha são obrigatórios' });
      }
      const roleNorm = normalizeRole(role);
      if (!canManageRole(req.user, roleNorm)) {
        return res.status(403).json({ error: 'Você não pode criar usuário com esse nível' });
      }

      const existente = await UsuarioModel.obterPorLogin(login);
      if (existente) {
        return res.status(400).json({ error: 'Login já cadastrado' });
      }

      const id = await UsuarioModel.criarUsuario({ nome, login, senha, role: roleNorm });
      const novo = await UsuarioModel.obterPorId(id);
      res.status(201).json({ message: 'Funcionário criado com sucesso', usuario: { ...novo, role: normalizeRole(novo.role) } });
    } catch (error) {
      console.error('Erro ao criar usuário:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async atualizarUsuario(req, res) {
    try {
      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ error: 'ID inválido' });

      const alvo = await UsuarioModel.obterPorId(id);
      if (!alvo) return res.status(404).json({ error: 'Usuário não encontrado' });
      if (!canManageUser(req.user, alvo) && req.user.id !== id) {
        return res.status(403).json({ error: 'Você não pode editar esse usuário' });
      }

      const patch = {};
      if (Object.prototype.hasOwnProperty.call(req.body, 'nome')) patch.nome = req.body.nome;
      if (Object.prototype.hasOwnProperty.call(req.body, 'login')) patch.login = req.body.login;
      if (Object.prototype.hasOwnProperty.call(req.body, 'senha')) patch.senha = req.body.senha;
      if (Object.prototype.hasOwnProperty.call(req.body, 'ativo')) patch.ativo = !!req.body.ativo;
      if (Object.prototype.hasOwnProperty.call(req.body, 'role')) {
        const novoRole = normalizeRole(req.body.role);
        if (!canManageRole(req.user, novoRole)) {
          return res.status(403).json({ error: 'Você não pode definir esse nível' });
        }
        patch.role = novoRole;
      }

      if (patch.login && patch.login !== alvo.login) {
        const conflito = await UsuarioModel.obterPorLogin(patch.login);
        if (conflito && Number(conflito.id) !== id) {
          return res.status(400).json({ error: 'Login já cadastrado' });
        }
      }

      await UsuarioModel.atualizarUsuario(id, patch);
      if (Object.prototype.hasOwnProperty.call(patch, 'ativo') && !patch.ativo) {
        await UsuarioModel.removerSessoesUsuario(id);
      }
      const atualizado = await UsuarioModel.obterPorId(id);
      res.json({ message: 'Usuário atualizado', usuario: { ...atualizado, role: normalizeRole(atualizado.role) } });
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async removerUsuario(req, res) {
    try {
      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ error: 'ID inválido' });
      if (req.user.id === id) {
        return res.status(400).json({ error: 'Você não pode remover o próprio usuário' });
      }

      const alvo = await UsuarioModel.obterPorId(id);
      if (!alvo) return res.status(404).json({ error: 'Usuário não encontrado' });
      if (!canManageUser(req.user, alvo)) {
        return res.status(403).json({ error: 'Você não pode remover esse usuário' });
      }

      await UsuarioModel.removerUsuario(id);
      await UsuarioModel.removerSessoesUsuario(id);
      res.json({ message: 'Usuário removido com sucesso' });
    } catch (error) {
      console.error('Erro ao remover usuário:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

export default AuthController;
