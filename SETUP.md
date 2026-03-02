# 🚀 Guia de Instalação - PDV System

## ⚠️ Pré-requisitos

Antes de começar, você precisa instalar **Node.js** no seu computador.

### Passo 1: Instalar Node.js

1. Acesse [https://nodejs.org/](https://nodejs.org/)
2. Baixe a versão ***LTS*** (Long Term Support)
3. Execute o instalador e siga os passos
4. **Importante**: Durante a instalação, certifique-se de marcar a opção "Add to PATH"

### Verificar Instalação

Após instalar, abra o PowerShell e teste:

```powershell
node --version
npm --version
```

Ambos devem retornar versões (ex: v18.00.0).

---

## 📦 Instalação do Projeto

### Passo 1: Abrir Terminal

1. Navegue até a pasta do projeto:
   ```powershell
   cd "C:\Users\Pedro\OneDrive\Documentos\PDV\backend"
   ```

### Passo 2: Instalar Dependências

```powershell
npm install
```

Este comando irá:
- Baixar todas as dependências (Express, sqlite3, cors, etc.)
- Criar a pasta `node_modules`
- Gerar um arquivo `package-lock.json`

**Isto pode levar alguns minutos na primeira execução.**

### Passo 3: Iniciar o Servidor

```powershell
npm start
```

Você deverá ver uma mensagem como:

```
===================================
🚀 PDV System - Backend iniciado
===================================
📡 Servidor rodando em http://localhost:3000
🌐 Acessível via rede: http://<seu-ip>:3000
📊 API de status: http://localhost:3000/api/status
===================================
```

### Passo 4: Testar a API

Abra um novo PowerShell e teste:

```powershell
# Testar se o servidor está rodando
curl http://localhost:3000/api/status

# Deve retornar:
# {"status":"OK","message":"API PDV está funcionando"}
```

---

## 🛠️ Modo Desenvolvimento

Para desenvolvimento com auto-reload:

```powershell
npm run dev
```

Isso reiniciará o servidor automaticamente ao detectar mudanças nos arquivos.

---

## 📁 Estrutura do Banco de Dados

O banco de dados SQLite (`pdv.db`) será criado **automaticamente** na pasta `backend` quando o servidor for iniciado.

### Tabelas criadas automaticamente:
- `produtos` - Catálogo de produtos
- `vendas` - Registros de vendas
- `venda_itens` - Itens de cada venda
- `ficha_tecnica` - Receitas de produtos compostos

---

## 🌐 Acessar de Outro Computador na Rede

Para acessar o servidor de outro computador:

1. **Descobrir o IP da máquina do servidor**:
   ```powershell
   ipconfig
   ```
   Procure por "Endereço IPv4" (ex: 192.168.1.100)

2. **De outro computador, acesse**:
   ```
   http://192.168.1.100:3000
   ```

---

## 🐛 Solução de Problemas

### Erro: "npm não é reconhecido"
- Node.js não está instalado ou não está no PATH
- **Solução**: Reinstale Node.js e certifique-se de marcar "Add to PATH"
- Reinicie o PowerShell após a instalação

### Erro: "A porta 3000 já está em uso"
- Feche outros programas que usam a porta 3000
- Ou mude a porta no arquivo `.env`

### Erro: "SQLite Error"
- Pode ser que um arquivo esteja bloqueado
- Feche o servidor, delete `pdv.db` e reinicie

---

## 📚 Próximos Passos

Após ter o backend rodando:

1. ✅ Backend está operacional
2. ⬜ Criar frontend (páginas HTML/CSS/JS)
3. ⬜ Conectar frontend com API
4. ⬜ Testar múltiplos dispositivos

---

## 📞 Suporte

Se tiver dúvidas sobre a instalação, verifique:
- [Node.js Documentation](https://nodejs.org/en/docs/)
- [npm Documentation](https://docs.npmjs.com/)
- [Express Documentation](https://expressjs.com/)

