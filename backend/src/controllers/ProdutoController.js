import ProdutoModel from '../models/ProdutoModel.js';

class ProdutoController {
  static async criar(req, res) {
    try {
      const { nome, preco, estoque, estoque_minimo, tipo, imagem } = req.body;

      if (!nome || !preco) {
        return res.status(400).json({ error: 'Nome e preço são obrigatórios' });
      }

      const id = await ProdutoModel.criar({
        nome,
        preco: parseFloat(preco),
        estoque: parseInt(estoque) || 0,
        estoque_minimo: parseInt(estoque_minimo) || 0,
        tipo: tipo || 'simples',
        imagem: imagem || null
      });

      res.status(201).json({ 
        message: 'Produto criado com sucesso',
        id: id
      });
    } catch (error) {
      console.error('Erro ao criar produto:', error);
      if (error.message.includes('UNIQUE')) {
        return res.status(400).json({ error: 'Produto com este nome já existe' });
      }
      res.status(500).json({ error: error.message });
    }
  }

  static async obterTodos(req, res) {
    try {
      const { incluir_inativos } = req.query;
      const produtos = await ProdutoModel.obterTodos(incluir_inativos !== 'true');
      res.json(produtos);
    } catch (error) {
      console.error('Erro ao obter produtos:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async obterPorId(req, res) {
    try {
      const { id } = req.params;
      const produto = await ProdutoModel.obterPorId(id);

      if (!produto) {
        return res.status(404).json({ error: 'Produto não encontrado' });
      }

      res.json(produto);
    } catch (error) {
      console.error('Erro ao obter produto:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async atualizar(req, res) {
    try {
      const { id } = req.params;
      const dados = req.body;

      const produto = await ProdutoModel.obterPorId(id);
      if (!produto) {
        return res.status(404).json({ error: 'Produto não encontrado' });
      }

      await ProdutoModel.atualizar(id, dados);
      res.json({ message: 'Produto atualizado com sucesso' });
    } catch (error) {
      console.error('Erro ao atualizar produto:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async deletar(req, res) {
    try {
      const { id } = req.params;
      const produto = await ProdutoModel.obterPorId(id);

      if (!produto) {
        return res.status(404).json({ error: 'Produto não encontrado' });
      }

      // Soft delete - marcar como inativo
      await ProdutoModel.atualizar(id, { ativo: 0 });
      res.json({ message: 'Produto deletado com sucesso' });
    } catch (error) {
      console.error('Erro ao deletar produto:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async obterEstoque(req, res) {
    try {
      const { id } = req.params;
      const produto = await ProdutoModel.obterPorId(id);

      if (!produto) {
        return res.status(404).json({ error: 'Produto não encontrado' });
      }

      // produtos temporários (avulsos) não possuem estoque válido
      const isAvulso = produto.nome && produto.nome.startsWith('Avulso') || produto.estoque >= 9999;
      if (isAvulso) {
        return res.json({ estoque: null, estoque_minimo: null });
      }

      const estoque = await ProdutoModel.obterEstoque(id);
      res.json(estoque);
    } catch (error) {
      console.error('Erro ao obter estoque:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

export default ProdutoController;
