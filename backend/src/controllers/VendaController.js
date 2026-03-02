import VendaModel from '../models/VendaModel.js';
import VendaItemModel from '../models/VendaItemModel.js';
import ProdutoModel from '../models/ProdutoModel.js';
import HistoricoModel from '../models/HistoricoModel.js';

// considera produto avulso qualquer item com nome iniciando por "Avulso" ou
// com estoque muito alto (marca temporários gerados para venda avulsa).
function isAvulso(produto){
  return (produto.nome && produto.nome.startsWith('Avulso')) || produto.estoque >= 9999;
}

async function registrarHistorico(acao, entidade_id, detalhes = null) {
  try {
    await HistoricoModel.registrar({
      tipo_entidade: 'venda',
      entidade_id,
      acao,
      detalhes
    });
  } catch (e) {
    console.warn('Falha ao registrar histórico de venda:', e.message);
  }
}

class VendaController {
  static async criar(req, res) {
    try {
      const { tipo, mesa } = req.body;

      if (!tipo || !['bar', 'fastfood'].includes(tipo)) {
        return res.status(400).json({ error: 'Tipo é obrigatório (bar ou fastfood)' });
      }

      const venda = await VendaModel.criar({
        tipo,
        status: tipo === 'fastfood' ? 'em_preparo' : 'aberta',
        mesa: mesa || null
      });

      res.status(201).json(venda);
      await registrarHistorico('venda_criada', venda.id, { tipo, mesa: mesa || null });
    } catch (error) {
      console.error('Erro ao criar venda:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async obterPorId(req, res) {
    try {
      const { id } = req.params;
      const venda = await VendaModel.obterPorId(id);

      if (!venda) {
        return res.status(404).json({ error: 'Venda não encontrada' });
      }

      const itens = await VendaItemModel.obterPorVenda(id);
      res.json({ ...venda, itens });
    } catch (error) {
      console.error('Erro ao obter venda:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async obterTodas(req, res) {
    try {
      const { tipo, status, data_inicio, data_fim } = req.query;
      const vendas = await VendaModel.obterTodas({ tipo, status, data_inicio, data_fim });
      res.json(vendas);
    } catch (error) {
      console.error('Erro ao obter vendas:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async obterAbertas(req, res) {
    try {
      const { tipo } = req.query;
      const vendas = await VendaModel.obertasAbertas(tipo);
      res.json(vendas);
    } catch (error) {
      console.error('Erro ao obter vendas abertas:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async obterEmPreparo(req, res) {
    try {
      const { status } = req.query;
      const vendas = status ? await VendaModel.obterParaProducao(status) : await VendaModel.obterEmPreparo();
      
      // Enriquecer com itens
      const vendasComItens = await Promise.all(
        vendas.map(async (venda) => {
          const itens = (await VendaItemModel.obterPorVenda(venda.id)).filter((i) => Number(i.produto_vai_cozinha) === 1);
          return { ...venda, itens };
        })
      );

      res.json(vendasComItens);
    } catch (error) {
      console.error('Erro ao obter pedidos em preparo:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async adicionarItem(req, res) {
    try {
      const { id } = req.params;
      const { produto_id, quantidade } = req.body;

      if (!produto_id || !quantidade) {
        return res.status(400).json({ error: 'produto_id e quantidade são obrigatórios' });
      }

      const venda = await VendaModel.obterPorId(id);
      if (!venda) {
        return res.status(404).json({ error: 'Venda não encontrada' });
      }

      const produto = await ProdutoModel.obterPorId(produto_id);
      if (!produto) {
        return res.status(404).json({ error: 'Produto não encontrado' });
      }

      // verifica se produto é temporário/avulso (não controla estoque)
      const avulso = isAvulso(produto);
      if(!avulso){
        // Protege contra produtos sem estoque ou inativos
        if(!produto.ativo){
          return res.status(400).json({ error: 'Produto indisponível' });
        }
        if (produto.estoque <= 0) {
          return res.status(400).json({ error: 'Produto sem estoque' });
        }
        if (produto.estoque < quantidade) {
          return res.status(400).json({ error: 'Estoque insuficiente' });
        }
      }

      // se já existir item com mesmo produto na venda, apenas atualiza a quantidade
      const itensVenda = await VendaItemModel.obterPorVenda(id);
      const existente = itensVenda.find(i => String(i.produto_id) === String(produto_id));
      if(existente){
        const novaQtd = existente.quantidade + quantidade;
        const novoSubtotal = existente.preco_unitario * novaQtd;
        await VendaItemModel.atualizar(existente.id, { quantidade: novaQtd, subtotal: novoSubtotal });
        if(!avulso){
          await ProdutoModel.atualizarEstoque(produto_id, -quantidade);
        }
        await VendaModel.obterTotal(id);
        if (Number(produto.vai_cozinha) === 1 && ['aberta', 'pronta'].includes(venda.status)) {
          await VendaModel.atualizar(id, { status: 'em_preparo' });
        }
        await registrarHistorico('item_quantidade_incrementada', parseInt(id, 10), {
          item_id: existente.id,
          produto_id,
          quantidade_adicionada: quantidade
        });
        return res.status(200).json({
          message: 'Quantidade de item atualizada',
          item_id: existente.id,
          subtotal: novoSubtotal
        });
      }

      // Calcular subtotal para novo item
      const subtotal = produto.preco * quantidade;

      // Adicionar item novo
      const itemId = await VendaItemModel.criar({
        venda_id: id,
        produto_id,
        quantidade,
        preco_unitario: produto.preco,
        subtotal
      });

      // Baixar estoque apenas se não tratar-se de avulso
      if(!avulso){
        await ProdutoModel.atualizarEstoque(produto_id, -quantidade);
      }

      // Atualizar total da venda
      await VendaModel.obterTotal(id);
      if (Number(produto.vai_cozinha) === 1 && ['aberta', 'pronta'].includes(venda.status)) {
        await VendaModel.atualizar(id, { status: 'em_preparo' });
      }
      await registrarHistorico('item_adicionado', parseInt(id, 10), { item_id: itemId, produto_id, quantidade });

      res.status(201).json({
        message: 'Item adicionado com sucesso',
        item_id: itemId,
        subtotal
      });
    } catch (error) {
      console.error('Erro ao adicionar item:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async removerItem(req, res) {
    try {
      const { id, item_id } = req.params;

      const item = await VendaItemModel.obterPorId(item_id);
      if (!item) {
        return res.status(404).json({ error: 'Item não encontrado' });
      }

      // Devolver estoque
      await ProdutoModel.atualizarEstoque(item.produto_id, item.quantidade);

      // Remover item
      await VendaItemModel.deletar(item_id);

      // Atualizar total
      await VendaModel.obterTotal(id);
      await registrarHistorico('item_removido', parseInt(id, 10), {
        item_id: parseInt(item_id, 10),
        produto_id: item.produto_id,
        quantidade: item.quantidade
      });

      res.json({ message: 'Item removido com sucesso' });
    } catch (error) {
      console.error('Erro ao remover item:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async atualizarItem(req, res) {
    try {
      const { id, item_id } = req.params;
      const { quantidade } = req.body;

      if (!quantidade || quantidade < 1) {
        return res.status(400).json({ error: 'Quantidade deve ser maior que 0' });
      }

      const item = await VendaItemModel.obterPorId(item_id);
      if (!item) {
        return res.status(404).json({ error: 'Item não encontrado' });
      }
      const venda = await VendaModel.obterPorId(id);
      if (!venda) {
        return res.status(404).json({ error: 'Venda não encontrada' });
      }

      const produto = await ProdutoModel.obterPorId(item.produto_id);
      if (!produto) {
        return res.status(404).json({ error: 'Produto não encontrado' });
      }

      // Verificar estoque (não para avulsos)
      const isAvulso = produto.nome.includes('Avulso') && produto.estoque >= 9999;
      if (!isAvulso) {
        const diferenca = quantidade - item.quantidade;
        if (diferenca > 0 && produto.estoque < diferenca) {
          return res.status(400).json({ error: 'Estoque insuficiente' });
        }
        // Ajustar estoque: se aumenta quantidade, baixa estoque; se diminui, devolve
        if (diferenca !== 0) {
          await ProdutoModel.atualizarEstoque(item.produto_id, -diferenca);
        }
      }

      // Atualizar item
      const novoSubtotal = item.preco_unitario * quantidade;
      await VendaItemModel.atualizar(item_id, {
        quantidade,
        subtotal: novoSubtotal
      });

      // Atualizar total
      await VendaModel.obterTotal(id);
      if (Number(produto.vai_cozinha) === 1 && ['aberta', 'pronta'].includes(venda.status)) {
        await VendaModel.atualizar(id, { status: 'em_preparo' });
      }
      await registrarHistorico('item_atualizado', parseInt(id, 10), {
        item_id: parseInt(item_id, 10),
        quantidade
      });

      res.json({ message: 'Item atualizado com sucesso', quantidade, subtotal: novoSubtotal });
    } catch (error) {
      console.error('Erro ao atualizar item:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async fechar(req, res) {
    try {
      const { id } = req.params;
      const { forma_pagamento } = req.body;

      if (!forma_pagamento) {
        return res.status(400).json({ error: 'Forma de pagamento é obrigatória' });
      }

      const venda = await VendaModel.obterPorId(id);
      if (!venda) {
        return res.status(404).json({ error: 'Venda não encontrada' });
      }

      await VendaModel.atualizar(id, {
        status: 'fechada',
        forma_pagamento
      });
      await registrarHistorico('venda_fechada', parseInt(id, 10), { forma_pagamento });

      res.json({ message: 'Venda fechada com sucesso' });
    } catch (error) {
      console.error('Erro ao fechar venda:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async marcarPronto(req, res) {
    try {
      const { id } = req.params;

      const venda = await VendaModel.obterPorId(id);
      if (!venda) {
        return res.status(404).json({ error: 'Venda não encontrada' });
      }

      await VendaModel.atualizar(id, { status: 'pronta' });
      await registrarHistorico('venda_marcada_pronta', parseInt(id, 10), null);

      res.json({ message: 'Pedido marcado como pronto' });
    } catch (error) {
      console.error('Erro ao marcar como pronto:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async atualizarStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!['aberta', 'em_preparo', 'pronta', 'fechada'].includes(status)) {
        return res.status(400).json({ error: 'Status inválido' });
      }

      const venda = await VendaModel.obterPorId(id);
      if (!venda) {
        return res.status(404).json({ error: 'Venda não encontrada' });
      }

      await VendaModel.atualizar(id, { status });
      await registrarHistorico('status_atualizado', parseInt(id, 10), { status });

      res.json({ message: 'Status atualizado com sucesso' });
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

export default VendaController;
