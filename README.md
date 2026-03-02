# Sistema PDV - Bar e Fast Food 🍔🍺

Sistema de Ponto de Venda (PDV) completo para gerenciar vendas em bares e fast foods com múltiplos dispositivos.

## Características

- ✅ **Modo Bar**: Comanda aberta com múltiplos itens
- ✅ **Modo Fast Food**: Pedidos sequenciais com controle de preparo
- ✅ **Controle de Estoque**: Baixa automática ao adicionar itens
- ✅ **Múltiplos Dispositivos**: Acesso simultâneo via rede local
- ✅ **Interface Responsiva**: Desktop e Mobile
- ✅ **Banco de Dados Local**: SQLite

## Estrutura do Projeto

```
pdv-system/
├── backend/                 # API REST em Node.js + Express
│   ├── src/
│   │   ├── database/       # Conexão e inicialização SQLite
│   │   ├── models/         # Modelos de dados (Produto, Venda, VendaItem)
│   │   ├── controllers/    # Lógica de negócio
│   │   ├── routes/         # Rotas da API
│   │   ├── services/       # Serviços reutilizáveis
│   │   └── app.js         # Configuração Express
│   ├── server.js          # Arquivo de inicialização
│   ├── package.json       # Dependências
│   └── pdv.db            # Banco de dados SQLite (criado automaticamente)
│
└── frontend/              # Aplicação Web responsiva
    ├── acesso.html        # Tela de acesso por perfil (entrada padrão)
    ├── admin.html         # Painel legado administrativo/testes
    ├── index.html         # Alias de compatibilidade para admin.html
    ├── pdv.html          # Interface do Caixa
    ├── garcom.html       # Interface do Garçom
    ├── producao.html     # Interface de Produção
    ├── css/              # Estilos
    └── js/               # JavaScript
```

## Instalação

### Requisitos
- Node.js v14+ 
- npm

### Passo 1: Instalar dependências do Backend

```bash
cd backend
npm install
```

### Passo 2: Iniciar o Servidor

```bash
npm start
```

Ou usar modo desenvolvimento com auto-reload:
```bash
npm run dev
```

O servidor iniciará em `http://localhost:3000`

## API REST Endpoints

### Produtos

```
GET    /api/produtos              # Listar todos os produtos
POST   /api/produtos              # Criar novo produto
GET    /api/produtos/:id          # Obter produto específico
GET    /api/produtos/:id/estoque  # Obter estoque
PUT    /api/produtos/:id          # Atualizar produto
DELETE /api/produtos/:id          # Deletar (desativar) produto
```

### Vendas

```
POST   /api/vendas                        # Criar nova venda
GET    /api/vendas                        # Listar todas as vendas
GET    /api/vendas/abertas                # Listar vendas abertas
GET    /api/vendas/preparacao/em-preparo  # Listar pedidos em preparo
GET    /api/vendas/:id                    # Obter venda específica
POST   /api/vendas/:id/itens              # Adicionar item
DELETE /api/vendas/:id/itens/:item_id     # Remover item
PUT    /api/vendas/:id/status             # Atualizar status
PUT    /api/vendas/:id/marcar-pronto      # Marcar como pronto
PUT    /api/vendas/:id/fechar             # Fechar venda
```

## Exemplos de Uso

### Criar Produto

```bash
curl -X POST http://localhost:3000/api/produtos \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "Cerveja Brahma 600ml",
    "preco": 15.50,
    "estoque": 50,
    "tipo": "simples"
  }'
```

### Criar Venda (Bar)

```bash
curl -X POST http://localhost:3000/api/vendas \
  -H "Content-Type: application/json" \
  -d '{"tipo": "bar"}'
```

### Criar Venda (Fast Food)

```bash
curl -X POST http://localhost:3000/api/vendas \
  -H "Content-Type: application/json" \
  -d '{"tipo": "fastfood"}'
```

### Adicionar Item à Venda

```bash
curl -X POST http://localhost:3000/api/vendas/1/itens \
  -H "Content-Type: application/json" \
  -d '{
    "produto_id": 1,
    "quantidade": 2
  }'
```

### Fechar Venda

```bash
curl -X PUT http://localhost:3000/api/vendas/1/fechar \
  -H "Content-Type: application/json" \
  -d '{"forma_pagamento": "dinheiro"}'
```

## Banco de Dados

### Tabelas

**produtos**
- id: INTEGER PRIMARY KEY
- nome: TEXT UNIQUE
- preco: DECIMAL
- estoque: INTEGER
- estoque_minimo: INTEGER
- tipo: 'simples' | 'composto'
- ativo: BOOLEAN
- created_at, updated_at: DATETIME

**vendas**
- id: INTEGER PRIMARY KEY
- tipo: 'bar' | 'fastfood'
- status: 'aberta' | 'em_preparo' | 'pronta' | 'fechada'
- numero_pedido: INTEGER (apenas fastfood)
- total: DECIMAL
- forma_pagamento: TEXT
- created_at, closed_at: DATETIME

**venda_itens**
- id: INTEGER PRIMARY KEY
- venda_id: FOREIGN KEY
- produto_id: FOREIGN KEY
- quantidade: INTEGER
- preco_unitario: DECIMAL
- subtotal: DECIMAL
- created_at: DATETIME

**ficha_tecnica**
- id: INTEGER PRIMARY KEY
- produto_id: FOREIGN KEY
- ingrediente_id: FOREIGN KEY
- quantidade_necessaria: DECIMAL

## Próximas Etapas

- [ ] Criar interfaces web responsivas
- [ ] Interface PDV (Caixa)
- [ ] Interface Garçom
- [ ] Interface Tela de Produção
- [ ] Adicionar autenticação
- [ ] Relatórios de vendas
- [ ] Sistema de sincronização em tempo real (WebSockets)

## Contribuição

Sinta-se livre para contribuir, reportar bugs ou sugerir melhorias!

## Licença

MIT
