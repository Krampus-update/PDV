# 🚀 Próximos Passos - PDV System

## ✅ Concluído: Backend Básico (implementado)

O backend foi desenvolvido e está funcional localmente. O que já foi implementado e testado:

### 📊 O que foi feito
- ✅ Conexão com SQLite e criação automática das tabelas (`produtos`, `vendas`, `venda_itens`, `ficha_tecnica`)
- ✅ Models: `ProdutoModel`, `VendaModel`, `VendaItemModel`
- ✅ Controllers e rotas REST para produtos e vendas (incluir/atualizar/remover/listar)
- ✅ Controle de estoque ao adicionar/remover itens
- ✅ Gerenciamento de status para vendas (aberta, em_preparo, pronta, fechada)
- ✅ Endpoint de health check `/api/status`
- ✅ Servir frontend estático pela pasta `frontend`

O servidor foi iniciado localmente e o banco foi criado (veja `pdv.db` na pasta `backend` após a primeira execução).

---

## 📍 Status Atual do Projeto (Mar/2026)

- **Fase atual:** **Transição Fase 4 → Fase 5**
- **Próxima fase:** iniciar pacote de melhorias (tempo real, autenticação, relatórios e backup)
- Entrada principal atual em `http://localhost:3000` com seleção por perfil

---

## 🎬 Começar Agora

### 1️⃣ Instalar Node.js (Se não tiver)
```powershell
# Visitar https://nodejs.org/
# Baixar versão LTS
# Instalar com "Add to PATH" marcado
# Reiniciar PowerShell
```

### 2️⃣ Instalar Dependências
```powershell
cd "C:\Users\Pedro\OneDrive\Documentos\PDV\backend"
npm install
```

### 4️⃣ Iniciar Servidor
```powershell
npm start
```

Você verá a mensagem de inicialização e logs indicando que o banco foi inicializado.

### 4️⃣ Testar a API e interfaces básicas
Abra o navegador e acesse:

```
http://localhost:3000
```

A raiz agora abre a tela de acesso por perfil:
- **Admin** → `admin.html` (tester técnico/operacional legado)
- **Cliente** → `painel.html` no desktop e `garcom.html` no mobile

---

## 🎯 Próximas Fases Recomendadas

### Fase 2: Frontend Principal (consolidada) ✅
Implementei a base do frontend e criei interfaces com abas:

- `frontend/acesso.html` — entrada principal por perfil (agora padrão em `/`)
- `frontend/admin.html` — tester/admin legado (com `index.html` como alias de compatibilidade)
- `frontend/painel.html` — painel principal com abas **Principal / Produtos / Comandas / Configurações**
  * **Principal**: grade de produtos clicáveis que adicionam itens ao carrinho; painel direito mostra carrinho e bloco de venda avulsa (teclado 0-9)
  * **Produtos**: visualização e gestão de estoque
  * **Comandas**: lista de comandas abertas; clicar abre detalhe onde é possível adicionar produtos, adicionar valor avulso e fechar a comanda
  * **Configurações**: nome, modo de operação e cor de destaque
- `frontend/js/painel.js` centraliza a lógica do painel (não fica mais inline no HTML)

Melhorias já aplicadas nesta fase:
- [x] Evitar criação de comanda duplicada (reaproveita comanda aberta da mesma mesa/balcão)
- [x] Renomeação da aba **Mesas** para **Comandas**
- [x] Alternância **Produtos / Valor Avulso** no detalhe da comanda
- [x] Atualização periódica de estoque/comandas para reduzir inconsistência entre telas
- [x] Correção do bug de edição de preço (ex.: R$ 8,00 salvar como R$ 0,08)

Status desta fase: consolidada e estável para operação local.

### Fase 3: Interface Garçom (estimado: 1-2 horas) ✅
A interface do garçom já está pronta e funcional. Ela é responsiva, lista comandas abertas
e permite adicionar/consultar itens e encerrar pedidos de forma rápida.  
Também há modal para visualização de detalhes e busca de produtos.

- [x] Interface mobile responsiva
- [x] Listar comandas abertas
- [x] Adicionar itens à comanda
- [x] Design simples e rápido
- [x] Modal de detalhes com remoção e finalização
- [x] Busca por produto integrada
- [x] Alinhamento de regras com painel desktop (mobile/desktop com comportamento equivalente)
- [x] Não duplicar comanda por mesa/balcão (reaproveita comanda aberta)
- [x] Alternância Produtos / Valor Avulso no detalhe da comanda
- [x] Atualização periódica de estoque/comandas para reduzir inconsistência entre telas

### Fase 4: Tela de Produção (Estimado: 1-2 horas) ✅
- [x] Listar pedidos em preparo
- [x] Marcar como pronto
- [x] Notificações sonoras de novos pedidos
- [x] Código de cores por tipo
- [x] Flag por produto para envio à cozinha (`vai_cozinha`)
- [x] Integração com painel/garçom: ao adicionar item de cozinha, comanda vai para `em_preparo`
- [x] Tela de produção exibe apenas itens de cozinha e separa abas `em_preparo` / `pronta`
- [x] Fluxo cozinha validado em runtime (criação de comanda → item de cozinha → produção)

Status desta fase: concluída.

### Fase 5: Melhorias (Estimado: 2-3 horas)
- [ ] WebSockets (tempo real)
- [ ] Autenticação/Login
- [ ] Relatórios de vendas
- [ ] Backup automático
- [ ] Histórico de transações (completo)

Preparativos já iniciados para Fase 5:
- [x] Tabela `historico_transacoes` criada no backend
- [x] Registro automático de eventos principais (produto/venda/item)
- [x] Endpoint de leitura de histórico: `GET /api/historico`

### Fase 6: Deploy (Estimado: 2-3 horas)
- [x] Configuração para rodar como serviço no Windows
- [x] Configuração de ambiente (variáveis, etc.)
- [x] Guia de deploy para produção
- [x] correção de bugs e melhorias pós-deploy

---

## 📚 Documentação Disponível

Todos estes arquivos foram criados para você:

1. **README.md** - Visão geral do projeto
   - Leia para entender a arquitetura geral

2. **SETUP.md** - Guia de instalação passo a passo
   - Se tiver erros ao instalar, consulte aqui

3. **API_DOCS.md** - Documentação completa da API
   - Referência de todos os 20 endpoints
   - Exemplos de uso com cURL

4. **IMPLEMENTACAO.md** - Resumo do que foi feito
   - Checklist de funcionalidades
   - Estrutura do banco de dados

5. **frontend/admin.html** - Tester/Admin da API
   - Interface visual para testar endpoints
   - Sem necessidade de cURL

---

## 🔧 Arquitetura Backend

```
Express (Servidor)
    ↓
Routes (Rotas HTTP)
    ↓
Controllers (Lógica de negócio)
    ↓
Models (Acesso ao banco)
    ↓
SQLite (Banco de dados)
```

Cada camada tem responsabilidade clara e testável.

---

## 💡 Exemplos Rápidos

### Criar um Produto via API
```bash
curl -X POST http://localhost:3000/api/produtos \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "Chopp 1L",
    "preco": 25.00,
    "estoque": 100,
    "tipo": "simples"
  }'
```

### Criar uma Venda
```bash
curl -X POST http://localhost:3000/api/vendas \
  -H "Content-Type: application/json" \
  -d '{"tipo": "bar"}'
```

### Adicionar Item à Venda
```bash
curl -X POST http://localhost:3000/api/vendas/1/itens \
  -H "Content-Type: application/json" \
  -d '{"produto_id": 1, "quantidade": 2}'
```

Ver mais exemplos em **API_DOCS.md**

---

## 🧪 Testando Localmente

### Teste 1: Verificar se o servidor está rodando
```bash
# Abra o navegador
http://localhost:3000

# Você verá a página inicial com links
```

### Teste 2: Testar a API com HTML
```bash
# Abra a tela de acesso
http://localhost:3000

# Depois selecione:
# - Admin (tester técnico)
# - Cliente (painel operacional)
```

### Teste 3: Criar fluxo completo
1. Criar 2-3 produtos
2. Criar uma venda
3. Adicionar 3-4 itens
4. Ver venda completa
5. Fechar venda

---

## 🌐 Acessar de Outro Computador

1. **Abra PowerShell no servidor e digite**:
   ```
   ipconfig
   ```

2. **Procure por "Endereço IPv4"** (ex: 192.168.1.100)

3. **De outro computador, acesse**:
   ```
   http://192.168.1.100:3000
   ```

---

## 📁 Estrutura de Pastas Final

```
PDV/
├── backend/                          ✅ Completo
│   ├── src/
│   │   ├── database/ ✅
│   │   ├── models/ ✅
│   │   ├── controllers/ ✅
│   │   ├── routes/ ✅
│   │   └── app.js ✅
│   ├── server.js ✅
│   └── package.json ✅
│
├── frontend/
│   ├── acesso.html ✅  (Entrada por perfil)
│   ├── admin.html ✅   (Tester/Admin)
│   ├── index.html ✅   (Alias para admin.html)
│   ├── painel.html ✅  (Cliente desktop)
│   ├── garcom.html ⏳  (Cliente mobile / alinhamento final)
│   ├── pdv.html ⏳     (Interface Caixa)
│   ├── producao.html ⏳ (Tela de Produção)
│   ├── css/ ⏳
│   └── js/ ⏳
│
├── README.md ✅
├── SETUP.md ✅
├── API_DOCS.md ✅
├── IMPLEMENTACAO.md ✅
└── PROXIMOS_PASSOS.md (Este arquivo)
```

---

## ⚡ Quick Start Resumido

```powershell
# 1. Abra PowerShell e navigate
cd "C:\Users\Pedro\OneDrive\Documentos\PDV\backend"

# 2. Instale dependências (primeira vez)
npm install

# 3. Inicie o servidor
npm start

# 4. Em outro PowerShell, teste
curl http://localhost:3000/api/status

# 5. No navegador, abra
http://localhost:3000
```

---

## 🎓 Para Aprender Mais

### Backend
- Express.js: https://expressjs.com/
- SQLite: https://www.sqlite.org/
- Node.js: https://nodejs.org/en/docs/

### Frontend (próximos)
- HTML/CSS/JS: https://developer.mozilla.org/
- Fetch API: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
- Responsive Design: https://www.w3schools.com/

---

## ✨ Dicas Importantes

1. **Backup do banco de dados**: Faça cópias de `pdv.db` regularmente
2. **Modo desenvolvimento**: Use `npm run dev` para auto-reload durante desenvolvimento
3. **Múltiplos clientes**: Todos acessam o mesmo banco de dados localmente
4. **Porta customizável**: Mude em `.env` se 3000 estiver ocupada
5. **Primeiros testes**: Use o tester HTML, depois integre ao frontend

---

## 🤝 Próximos Passos

Quando você estiver pronto para o frontend, me avise e criaremos:
1. **Interface PDV** - Completa e responsiva
2. **Interface Garçom** - Mobile-first para tablets
3. **Tela de Produção** - Para cozinha/preparo

Cada interface consumirá a API que acabamos de criar! 🎉

---

## 📞 Checklist Final

- [ ] Node.js instalado
- [ ] npm install executado
- [ ] npm start funcionando
- [ ] Status verde (Online)
- [ ] Tester HTML aberto e testado
- [ ] Fluxo completo testado (Criar → Venda → Item → Fechar)
- [ ] API acessível de outro computador
- [ ] Documentação lida

Após isso, você está pronto para a próxima fase! 🚀

