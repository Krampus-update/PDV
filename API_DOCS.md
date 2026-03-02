# 📖 Documentação da API - PDV System

## Base URL

```
http://localhost:3000/api
```

ou de outra máquina:

```
http://<seu-ip>:3000/api
```

---

## 🏪 PRODUTOS

### Criar Novo Produto

**POST** `/produtos`

```bash
curl -X POST http://localhost:3000/api/produtos \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "Cerveja Brahma 600ml",
    "preco": 15.50,
    "estoque": 50,
    "estoque_minimo": 10,
    "tipo": "simples"
  }'
```

**Resposta (201)**:
```json
{
  "message": "Produto criado com sucesso",
  "id": 1
}
```

---

### Listar Todos os Produtos

**GET** `/produtos`

```bash
curl http://localhost:3000/api/produtos
```

**Query Parameters**:
- `incluir_inativos=true` - Incluir produtos desativados (padrão: false)

**Resposta (200)**:
```json
[
  {
    "id": 1,
    "nome": "Cerveja Brahma 600ml",
    "preco": 15.50,
    "estoque": 48,
    "estoque_minimo": 10,
    "tipo": "simples",
    "ativo": 1,
    "created_at": "2026-02-26T15:30:00.000Z",
    "updated_at": "2026-02-26T15:30:00.000Z"
  }
]
```

---

### Obter Produto Específico

**GET** `/produtos/:id`

```bash
curl http://localhost:3000/api/produtos/1
```

**Resposta (200)**:
```json
{
  "id": 1,
  "nome": "Cerveja Brahma 600ml",
  "preco": 15.50,
  "estoque": 48,
  "estoque_minimo": 10,
  "tipo": "simples",
  "ativo": 1,
  "created_at": "2026-02-26T15:30:00.000Z",
  "updated_at": "2026-02-26T15:30:00.000Z"
}
```

---

### Obter Estoque

**GET** `/produtos/:id/estoque`

```bash
curl http://localhost:3000/api/produtos/1/estoque
```

**Resposta (200)**:
```json
{
  "estoque": 48,
  "estoque_minimo": 10
}
```

---

### Atualizar Produto

**PUT** `/produtos/:id`

```bash
curl -X PUT http://localhost:3000/api/produtos/1 \
  -H "Content-Type: application/json" \
  -d '{
    "preco": 16.50,
    "estoque": 60,
    "estoque_minimo": 5
  }'
```

**Resposta (200)**:
```json
{
  "message": "Produto atualizado com sucesso"
}
```

---

### Deletar (Desativar) Produto

**DELETE** `/produtos/:id`

```bash
curl -X DELETE http://localhost:3000/api/produtos/1
```

**Resposta (200)**:
```json
{
  "message": "Produto deletado com sucesso"
}
```

---

## 💰 VENDAS

### Criar Nova Venda

**POST** `/vendas`

**Modo BAR**:
```bash
curl -X POST http://localhost:3000/api/vendas \
  -H "Content-Type: application/json" \
  -d '{"tipo": "bar"}'
```

**Modo FAST FOOD**:
```bash
curl -X POST http://localhost:3000/api/vendas \
  -H "Content-Type: application/json" \
  -d '{"tipo": "fastfood"}'
```

**Resposta (201)**:
```json
{
  "id": 1,
  "tipo": "bar",
  "numero_pedido": null
}
```

ou para fast food:
```json
{
  "id": 1,
  "tipo": "fastfood",
  "numero_pedido": 1
}
```

---

### Listar Todas as Vendas

**GET** `/vendas`

```bash
curl "http://localhost:3000/api/vendas?tipo=bar&status=aberta"
```

**Query Parameters**:
- `tipo` - `bar` ou `fastfood`
- `status` - `aberta`, `em_preparo`, `pronta`, `fechada`
- `data_inicio` - ISO date
- `data_fim` - ISO date

**Resposta (200)**:
```json
[
  {
    "id": 1,
    "tipo": "bar",
    "status": "aberta",
    "numero_pedido": null,
    "total": 0,
    "forma_pagamento": null,
    "observacoes": null,
    "created_at": "2026-02-26T15:30:00.000Z",
    "closed_at": null
  }
]
```

---

### Obter Vendas Abertas

**GET** `/vendas/abertas?tipo=bar`

```bash
# Obter todas as vendas abertas
curl http://localhost:3000/api/vendas/abertas

# Obter vendas abertas de bar
curl "http://localhost:3000/api/vendas/abertas?tipo=bar"

# Obter vendas abertas de fast food
curl "http://localhost:3000/api/vendas/abertas?tipo=fastfood"
```

---

### Obter Pedidos em Preparo (Fast Food)

**GET** `/vendas/preparacao/em-preparo`

```bash
curl http://localhost:3000/api/vendas/preparacao/em-preparo
```

**Resposta (200)**:
```json
[
  {
    "id": 1,
    "tipo": "fastfood",
    "status": "em_preparo",
    "numero_pedido": 1,
    "total": 45.50,
    "itens": [
      {
        "id": 1,
        "quantidade": 1,
        "preco_unitario": 25.50,
        "subtotal": 25.50,
        "produto_nome": "X-Burger",
        "produto_tipo": "simples"
      }
    ]
  }
]
```

---

### Obter Venda Específica com Itens

**GET** `/vendas/:id`

```bash
curl http://localhost:3000/api/vendas/1
```

**Resposta (200)**:
```json
{
  "id": 1,
  "tipo": "bar",
  "status": "aberta",
  "total": 31.00,
  "numero_pedido": null,
  "itens": [
    {
      "id": 1,
      "venda_id": 1,
      "produto_id": 1,
      "quantidade": 2,
      "preco_unitario": 15.50,
      "subtotal": 31.00,
      "produto_nome": "Cerveja Brahma 600ml",
      "produto_tipo": "simples"
    }
  ]
}
```

---

### Adicionar Item à Venda

**POST** `/vendas/:id/itens`

```bash
curl -X POST http://localhost:3000/api/vendas/1/itens \
  -H "Content-Type: application/json" \
  -d '{
    "produto_id": 1,
    "quantidade": 2
  }'
```

**Resposta (201)**:
```json
{
  "message": "Item adicionado com sucesso",
  "item_id": 1,
  "subtotal": 31.00
}
```

---

### Remover Item da Venda

**DELETE** `/vendas/:id/itens/:item_id`

```bash
curl -X DELETE http://localhost:3000/api/vendas/1/itens/1
```

**Resposta (200)**:
```json
{
  "message": "Item removido com sucesso"
}
```

---

### Atualizar Status da Venda

**PUT** `/vendas/:id/status`

```bash
curl -X PUT http://localhost:3000/api/vendas/1/status \
  -H "Content-Type: application/json" \
  -d '{"status": "fechada"}'
```

**Status válidos**:
- `aberta` - Venda aberta
- `em_preparo` - Em preparação
- `pronta` - Pronta para entrega/consumo
- `fechada` - Finalizada

**Resposta (200)**:
```json
{
  "message": "Status atualizado com sucesso"
}
```

---

### Marcar Pedido como Pronto (Fast Food)

**PUT** `/vendas/:id/marcar-pronto`

```bash
curl -X PUT http://localhost:3000/api/vendas/1/marcar-pronto
```

**Resposta (200)**:
```json
{
  "message": "Pedido marcado como pronto"
}
```

---

### Fechar Venda (Bar)

**PUT** `/vendas/:id/fechar`

```bash
curl -X PUT http://localhost:3000/api/vendas/1/fechar \
  -H "Content-Type: application/json" \
  -d '{"forma_pagamento": "débito"}'
```

**Formas de pagamento sugestões**:
- `dinheiro`
- `débito`
- `crédito`
- `pix`

**Resposta (200)**:
```json
{
  "message": "Venda fechada com sucesso"
}
```

---

## 🔀 Fluxo Completo - Exemplo

### 1. Criar Produtos

```bash
# Cerveja
curl -X POST http://localhost:3000/api/produtos \
  -H "Content-Type: application/json" \
  -d '{"nome":"Cerveja 600ml","preco":15.50,"estoque":100,"tipo":"simples"}'

# Refrigerante
curl -X POST http://localhost:3000/api/produtos \
  -H "Content-Type: application/json" \
  -d '{"nome":"Refrigerante 2L","preco":8.50,"estoque":50,"tipo":"simples"}'
```

### 2. Criar Venda (Bar)

```bash
curl -X POST http://localhost:3000/api/vendas \
  -H "Content-Type: application/json" \
  -d '{"tipo":"bar"}'

# Retorna: {"id":1,"tipo":"bar","numero_pedido":null}
```

### 3. Adicionar Itens

```bash
# Adicionar 2 cervejas
curl -X POST http://localhost:3000/api/vendas/1/itens \
  -H "Content-Type: application/json" \
  -d '{"produto_id":1,"quantidade":2}'

# Adicionar 1 refrigerante
curl -X POST http://localhost:3000/api/vendas/1/itens \
  -H "Content-Type: application/json" \
  -d '{"produto_id":2,"quantidade":1}'
```

### 4. Visualizar Venda

```bash
curl http://localhost:3000/api/vendas/1

# Retorna total: 15.50*2 + 8.50*1 = 39.50
```

### 5. Fechar Venda

```bash
curl -X PUT http://localhost:3000/api/vendas/1/fechar \
  -H "Content-Type: application/json" \
  -d '{"forma_pagamento":"dinheiro"}'
```

---

## ⚠️ Códigos de Erro

| Código | Significado |
|--------|-------------|
| 200 | OK - Requisição bem-sucedida |
| 201 | Created - Recurso criado com sucesso |
| 400 | Bad Request - Dados inválidos |
| 404 | Not Found - Recurso não encontrado |
| 500 | Internal Server Error - Erro do servidor |

**Exemplo de erro**:
```json
{
  "error": "Estoque insuficiente"
}
```

---

## 📝 Notas

- Os preços devem ser números (ex: 15.50, não "15,50")
- As quantidades devem ser inteiros
- O estoque é automaticamente baixado ao adicionar itens
- O total da venda é calculado automaticamente

