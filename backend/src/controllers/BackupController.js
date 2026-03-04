import { criarBackupManual, listarBackups } from '../services/backupService.js';
import HistoricoModel from '../models/HistoricoModel.js';

class BackupController {
  static async executar(req, res) {
    try {
      const arquivo = await criarBackupManual();
      try {
        await HistoricoModel.registrar({
          tipo_entidade: 'backup',
          entidade_id: null,
          acao: 'backup_manual',
          detalhes: { arquivo }
        });
      } catch {
        // ignorar erro de histórico
      }
      res.json({ message: 'Backup gerado com sucesso', arquivo });
    } catch (error) {
      console.error('Erro ao executar backup:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async listar(req, res) {
    try {
      const backups = await listarBackups();
      res.json(backups);
    } catch (error) {
      console.error('Erro ao listar backups:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

export default BackupController;
