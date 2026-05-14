# VG Matchmaking BR — Bot do Telegram

## Como usar

### Primeiro acesso

1. Abra o bot no Telegram pelo link fornecido pelo administrador
2. Digite `/start`
3. O bot vai pedir que você escolha um **nick** (3 a 16 caracteres)
4. Digite seu nick e envie — ele será salvo permanentemente
5. O menu principal vai aparecer

---

### Menu principal

Após o cadastro, sempre que você digitar `/start` vai ver o menu com as opções:

| Botão | O que faz |
|---|---|
| 🎯 Entrar 3v3 | Entra na fila para partida 3 contra 3 |
| 🔥 Entrar 5v5 | Entra na fila para partida 5 contra 5 |
| ❌ Sair da fila | Sai da fila sem entrar em partida |
| 👤 Meu perfil | Exibe suas estatísticas |
| 🏆 Ranking | Exibe o top 10 de jogadores |

---

### Encontrando uma partida

1. Clique em **Entrar 3v3** ou **Entrar 5v5**
2. Aguarde jogadores suficientes entrarem na fila
   - 3v3 → precisa de 6 jogadores
   - 5v5 → precisa de 10 jogadores
3. Quando a fila fechar, você recebe uma mensagem com:
   - O **código** da partida
   - O **nick temporário** que você deve usar no jogo
4. Troque seu nick no jogo para o nick indicado e clique **✅ Nick alterado**
5. Quando todos confirmarem, uma contagem regressiva de 10 segundos inicia
6. Ao chegar em zero: **BUSQUEM A PARTIDA** no jogo

---

### Reportando o resultado

Após 20 minutos do início da busca, o bot vai te perguntar o resultado:

- ✅ **Ganhei** — se seu time venceu
- ❌ **Perdi** — se seu time perdeu

O resultado atualiza automaticamente seu **VG Index** e suas estatísticas.

---

### Perfil e ranking

- **👤 Meu perfil** — mostra seu nick, VG Index, vitórias, derrotas, winrate e total de partidas
- **🏆 Ranking** — mostra o top 10 jogadores com 20 ou mais partidas, ordenado por VG Index

---

### Trocando seu nick

Para trocar seu nick a qualquer momento use o comando:

```
/changenick SeuNovoNick
```

O nick deve ter entre 3 e 16 caracteres e não pode estar em uso por outro jogador.

---

### VG Index

O VG Index é a pontuação que mede seu desempenho. Começa em 50 pontos e é calculado com base nas suas vitórias e no total de partidas jogadas. Quanto mais você vencer, maior seu índice.
