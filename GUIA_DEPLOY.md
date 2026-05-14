# 🚀 GUIA COMPLETO — VG MATCHMAKING MINI APP + BOT NO RAILWAY

---

## 📁 ESTRUTURA FINAL DO PROJETO

```
vg-matchmaking/
├── index.js          ← ponto de entrada (boot server + bot)
├── server.js         ← Express + Socket.IO + API REST
├── database.js       ← conexão MySQL (inalterado)
├── matchmaking.js    ← lógica de fila (inalterado)
├── ranking.js        ← cálculo de FC (inalterado)
├── package.json      ← dependências atualizadas
├── Procfile          ← para Railway
├── bot/
│   └── index.js      ← bot Telegraf (refatorado)
└── public/
    └── index.html    ← Mini App (interface web)
```

---

## PARTE 1 — CONFIGURAR O BOT NO TELEGRAM

### 1.1 Criar o Mini App no BotFather

1. Abra o Telegram e vá até `@BotFather`
2. Envie `/newapp` (ou `/mybots` → selecione seu bot → `Bot Settings` → `Menu Button`)
3. Siga as instruções:
   - **Title:** VG Matchmaking BR
   - **Description:** Saguão, ranking e partidas em tempo real
   - **Photo:** envie qualquer imagem 640×360
   - **GIF:** pode pular
   - **URL:** `https://SEU-PROJETO.railway.app` ← você vai preencher depois

4. O BotFather vai retornar o **app_link** do Mini App. Guarde.

### 1.2 Ativar o botão de menu

```
/mybots → Seu Bot → Bot Settings → Menu Button → Edit Menu Button URL
→ cole a URL do Railway
```

---

## PARTE 2 — CONFIGURAR O RAILWAY

### 2.1 Criar o projeto

1. Acesse https://railway.app e faça login
2. Clique em **New Project → Deploy from GitHub repo**
3. Selecione seu repositório (ou faça upload direto)
4. Railway vai detectar o `Procfile` e usar `node index.js`

### 2.2 Adicionar o MySQL

1. No painel do projeto, clique em **+ New**
2. Selecione **Database → MySQL**
3. Railway vai criar o banco e expor a variável `DATABASE_URL` automaticamente

> **Atenção:** O `database.js` já está configurado para ler `DATABASE_URL`.
> Você não precisa fazer mais nada com o banco — as tabelas são criadas automaticamente no boot.

### 2.3 Configurar as variáveis de ambiente

Vá em **Settings → Variables** no seu serviço Node e adicione:

| Variável             | Valor                                      | Obrigatório |
|----------------------|--------------------------------------------|-------------|
| `BOT_TOKEN`          | Token do BotFather (ex: `123456:ABCdef...`) | ✅ Sim      |
| `WEBAPP_URL`         | `https://SEU-PROJETO.railway.app`           | ✅ Sim      |
| `INTERNAL_SECRET`    | Uma string aleatória (ex: `xK9mP2qR7`)     | ✅ Sim      |
| `ADMIN_TELEGRAM_ID`  | Seu Telegram ID numérico                    | Recomendado |
| `DATABASE_URL`       | Preenchido automaticamente pelo Railway     | Auto        |
| `PORT`               | Não precisa (Railway define automaticamente)| Auto        |

**Como descobrir seu Telegram ID:**
Envie qualquer mensagem para `@userinfobot` no Telegram.

---

## PARTE 3 — FAZER DEPLOY

### 3.1 Via GitHub (recomendado)

```bash
# Na sua máquina local, dentro da pasta do projeto:
git init
git add .
git commit -m "feat: adiciona Mini App e Express server"
git remote add origin https://github.com/SEU_USER/SEU_REPO.git
git push -u origin main
```

Railway vai detectar o push e fazer deploy automático.

### 3.2 Via Railway CLI (alternativa)

```bash
npm install -g @railway/cli
railway login
railway link          # vincula ao projeto existente
railway up            # faz deploy
```

### 3.3 Verificar o deploy

No painel Railway, clique em **Deployments** e veja os logs.
Você deve ver:

```
[BOOT] Inicializando banco de dados...
[BOOT] Carregando partidas ativas...
[BOOT] Iniciando servidor Express + Socket.IO...
[SERVER] http://localhost:3000
[BOOT] Iniciando bot Telegram...
[BOT] Tentativa 1/5...
[BOT] ✅ Bot online!
[BOOT] ✅ Tudo online!
```

---

## PARTE 4 — REGISTRAR A URL DO MINI APP

Depois do deploy, copie a URL pública gerada pelo Railway:
`https://SEU-PROJETO.railway.app`

Volte ao BotFather e atualize:
```
/mybots → Seu Bot → Bot Settings → Menu Button → Edit Menu Button URL
→ cole https://SEU-PROJETO.railway.app
```

---

## PARTE 5 — TESTAR O MINI APP

### 5.1 Testar via browser (só a UI)
Acesse `https://SEU-PROJETO.railway.app` direto no browser.
O perfil e ações de queue **não vão funcionar** (precisa de ID do Telegram),
mas você verá o ranking e o saguão ao vivo.

### 5.2 Testar via Telegram
1. Abra seu bot no Telegram
2. Envie `/start`
3. Use os botões inline normalmente (fila, perfil, etc.)
4. Clique em **🌐 Abrir VG App** para abrir o Mini App dentro do Telegram
5. O Mini App vai reconhecer seu usuário automaticamente via `Telegram.WebApp.initDataUnsafe.user`

---

## PARTE 6 — COMO O SISTEMA FUNCIONA

### Fluxo de dados

```
Usuário (Telegram bot)
        ↓ ação (join queue, confirm, etc.)
    bot/index.js
        ↓ altera estado (onlineUsers, queues, activeMatches)
        ↓ chama broadcastState()
    server.js
        ↓ io.emit('state_update', state)
    Mini App (browser/Telegram WebApp)
        ↓ socket.on('state_update') → re-renderiza
```

### Eventos Socket.IO enviados pelo bot → Mini App

| Evento           | Quando disparado              | O que o Mini App faz         |
|------------------|-------------------------------|------------------------------|
| `state_update`   | Qualquer mudança de estado    | Atualiza saguão e ranking    |
| `match_found`    | Partida criada                | Navega para aba Partida      |
| `countdown_start`| Todos confirmaram             | Inicia contagem regressiva   |
| `result_request` | 3 minutos após a partida      | Mostra botões de resultado   |

---

## PARTE 7 — SOLUÇÃO DE PROBLEMAS

### Bot não conecta
- Verifique `BOT_TOKEN` nas variáveis do Railway
- Certifique que não há outro processo usando o mesmo token

### Mini App em branco
- Abra o DevTools no browser e veja o console
- Verifique se `WEBAPP_URL` está correto nas variáveis
- O Mini App precisa de HTTPS — o Railway já fornece isso

### Socket não conecta (fica "desconectado")
- O Railway permite WebSockets por padrão — não precisa configurar nada
- Verifique se a URL pública está correta

### DATABASE_URL não encontrado
- Verifique se o serviço MySQL foi criado no mesmo projeto Railway
- Vá em Variables e confirme que `DATABASE_URL` aparece listada

### Usuário não aparece no Mini App (só vê dados gerais)
- O Mini App precisa ser aberto **dentro do Telegram** para ter o ID do usuário
- Abrir direto no browser não fornece `initDataUnsafe.user`

---

## PARTE 8 — VARIÁVEIS DE AMBIENTE COMPLETAS (resumo)

Copie e cole no Railway → Variables:

```
BOT_TOKEN=SEU_TOKEN_AQUI
WEBAPP_URL=https://SEU-PROJETO.railway.app
INTERNAL_SECRET=troque_por_string_aleatoria
ADMIN_TELEGRAM_ID=SEU_ID_NUMERICO
```

---

## PARTE 9 — DEPENDÊNCIAS (package.json)

As novas dependências adicionadas em relação ao projeto original:

| Pacote      | Versão  | Para que serve               |
|-------------|---------|------------------------------|
| `express`   | ^4.18.3 | Servidor HTTP + API REST     |
| `socket.io` | ^4.7.5  | WebSocket tempo real         |
| `cors`      | ^2.8.5  | Headers CORS para o Mini App |

As já existentes (`telegraf`, `mysql2`) permanecem inalteradas.

---

## DICAS FINAIS

- **Domínio customizado:** Em Railway → Settings → Networking você pode adicionar seu próprio domínio
- **Logs em tempo real:** Use `railway logs` na CLI ou veja no painel web
- **Escalabilidade:** O estado das filas (`onlineUsers`, `queue3v3`, etc.) fica em memória. Para múltiplas instâncias, seria necessário Redis — mas para seu caso de uso atual, uma instância é suficiente.
- **Segurança:** A rota `/api/internal/broadcast` exige `INTERNAL_SECRET` para evitar abusos externos.
