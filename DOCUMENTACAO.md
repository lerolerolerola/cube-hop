# Cube Hop — Documentação

Documento para quem vai usar, testar ou apresentar o jogo (equipa, entrevistas, terceiros).
Jogar: https://lerolerolerola.github.io/cube-hop/ · Código: https://github.com/lerolerolerola/cube-hop

---

## 1. O que é

Cube Hop é um jogo de plataformas em pixel art para telemóvel, feito para estudar **design para o desengajamento**: como ajudar uma criança a **parar de jogar de forma saudável**, sem castigos nem manipulação.

O jogo joga-se como um jogo normal (D-pad + botões A/B). Os **sensores do telemóvel não são controlos**: servem só para as pausas e para terminar a sessão.

Há duas versões com a mesma interface. **Escolhe-se no ecrã inicial**, com os botões **🐻 WITH PIP** / **NO MASCOT** (a escolha fica guardada):

| Versão | Para quê |
|---|---|
| **Sem mascote** | O jogo com todas as ferramentas de pausa e fim de sessão |
| **Com mascote (Pip)** | Igual, mais uma mascote que guia a criança e é alimentada pelas pausas. As atividades passam a ser feitas *com* o Pip |

Também se pode abrir já com o Pip escolhido com `.../cube-hop/?mascot`, ou mudar em ⚙ Adultos → *Mascot*.

Juntar `&dev` (ex.: `?mascot&dev`) ativa o modo de teste (ver secção 7).

---

## 2. Como jogar

| Telemóvel | PC (testes) | Ação |
|---|---|---|
| D-pad ◀ ▶ | Setas / A D | Andar |
| A (ou ▲) | Espaço / W / ↑ | Saltar; carregar outra vez no ar = salto duplo |
| B | Shift / X | Dash (um por salto, elimina inimigos) |
| Abanar com força | Manter **E** | Simula um "abanão de raiva" |
| Pousar virado para baixo | Manter **F** | Simula o telemóvel virado para baixo |

**4 níveis**, cada um ensina um movimento: 1 salto · 2 salto duplo (paredes altas) · 3 dash (buracos largos) · 4 tudo junto, com inimigos mais rápidos.

O progresso fica guardado no início de cada nível.

---

## 3. Como corre uma sessão

```
Início ──► jogar ──► pausa a cada N min ──┬─► faz uma atividade ──► volta a jogar (contador a zero)
                                          └─► "Agora não" ──► a pausa volta 1 min depois
Muito tempo seguido sem fazer pausa ──► fricção crescente, até fazer uma pausa
Perto do fim ──► aviso (cores cinzentas, música abranda) ──► "Acabou o tempo!"
             ──► terminar o nível (máx. 2 min) ou parar ──► cartão final
```

A barra no topo mostra o tempo da sessão; os **quadrados verdes** na barra marcam as pausas.

### Princípios e onde aparecem

Princípios que extraímos do artigo *Designing for Disengagement* (Alsheail, Alexandrovsky e Gerling, 2023).

| Princípio | No jogo |
|---|---|
| **Autonomia** | Botão de pausa com "Parar de jogar" a qualquer momento; a criança escolhe a atividade da pausa ou adia-a ("Agora não"); "Acabei por hoje" em todas as pausas; "Parar aqui" depois de cada nível; a fricção desaparece assim que faz uma pausa |
| **Transição gradual** | Aviso antes do fim; cores desvanecem para cinzento e a música abranda |
| **Conclusão satisfatória** | Quando o tempo acaba, a criança tem 2 minutos para terminar o nível atual e recebe um cartão final |
| **Continuidade** | O progresso fica guardado (retoma no início do nível). O tempo de jogo do dia também: parar e carregar em CONTINUE não reinicia a barra |
| **Contexto social** | Painel de adultos (atrás de uma conta de multiplicar); o cartão final diz "conta a um adulto o que fizeste" |
| **Evitar manipulação** | Sem prémios por ficar, sem streaks, sem temporizadores que puxam a criança de volta; não há tempo extra |

---

## 4. Pausas com atividades (os sensores como ferramentas)

A cada N minutos (definido pelo adulto) o jogo pára e a criança **escolhe** uma atividade. Também pode **adiar** ("Agora não"; a pausa volta passado 1 minuto) ou dizer "Acabei por hoje". Fazer uma atividade põe a zero o contador de tempo seguido sem pausa (secção 5).

| Atividade | O que a criança faz | Sensor | Como o jogo verifica |
|---|---|---|---|
| 📷 **Encontrar uma cor** | Aponta a câmara a algo da cor pedida, enche o quadrado e carrega em SNAP | Câmara | ≥30% do quadrado central tem essa cor |
| 🚶 **Dar uma volta** | Anda N passos (por defeito 20) com o telemóvel na mão | Acelerómetro | Conta os picos de aceleração |
| 🧘 **Respirar** | Segura o telemóvel quieto e respira com o círculo (8 s) | Acelerómetro | Movimento muito baixo; mexer faz a barra recuar |
| 🎤 **Cantarolar** | Cantarola uma música durante 3 s | Microfone | Volume acima de um limiar |
| 📵 **Pousar o telemóvel** *(nova)* | Pousa o telemóvel **com o ecrã para baixo** durante X segundos (por defeito 60) e vai fazer outra coisa | Orientação | O telemóvel está virado ao contrário (inclinação > 150°). **Se o levantar, o tempo recomeça do zero** |

**Porque é que a 📵 é diferente:** todas as outras atividades continuam a usar o telemóvel. Esta é a única em que a pausa é **não usar o telemóvel de todo**. Há um som quando é bem pousado, um som grave se for levantado, e um som de vitória no fim, por isso a criança não precisa de olhar para o ecrã.

> Nota técnica: no iPhone o jogo pede permissão de "Movimento e Orientação" ao carregar em CONTINUE/NEW GAME. Sem essa permissão, as atividades de movimento e a 📵 não funcionam.

---

## 5. Fricção e fim do tempo

A fricção está ligada a comportamentos (fugir das pausas, frustração) e não ao relógio. O fim do tempo não tem castigos.

### Jogar muito tempo seguido sem pausa

O jogo conta o tempo de jogo desde a **última pausa feita**. Adiar pausas ("Agora não") faz esse tempo crescer. Quando passa do limite definido pelo adulto (por defeito 10 minutos), o jogo vai ficando estranho, aos poucos:

| Tempo seguido sem pausa | Efeito |
|---|---|
| 10 min | Aviso "Jogaste muito tempo sem pausa! Faz uma pausa para o jogo voltar ao normal"; cores cinzentas e música mais lenta |
| 12 min | Cores em negativo e música desafinada |
| 14 min | Esquerda e direita trocadas |
| 16 min | O jogo ignora alguns saltos |

**Fazer qualquer atividade de pausa repõe tudo** e põe o contador a zero. A saída está sempre nas mãos da criança: quem faz as pausas nunca vê estes efeitos, por mais que jogue na semana.

O adulto pode mudar o limite (0 = desligado) e desligar o negativo, a troca de controlos e os saltos ignorados. Se as pausas estiverem desligadas, esta fricção também fica desligada (não haveria forma de a desfazer).

### Frustração

Abanar o telemóvel com raiva troca a esquerda e a direita. Aparece um botão para acalmar; acalmar (segurar o telemóvel quieto) repõe os controlos.

### Fim do tempo (sessão ou semana)

Não há tempo extra nem castigos. Quando acaba o tempo da sessão ou o tempo da semana:

1. **2 minutos antes:** aviso "Quase a acabar"; as cores desvanecem para cinzento e a música abranda.
2. **Pop-up "Acabou o tempo!"** com três opções: **Terminar o nível** (tem 2 minutos), **Parar agora**, ou **+5 min** (só com o adulto).
3. Se terminar o nível dentro dos 2 minutos, recebe "Acabaste mesmo a tempo!" e o cartão final. Se os 2 minutos passarem, o jogo termina sozinho com o cartão final. O progresso fica guardado no início do nível.

### Tempo semanal

O tempo de jogo conta por semana (na versão final, assumimos que é medido pelo plug-in). Quando acaba a meio de uma sessão, a sessão termina como descrito acima. Depois disso o jogo fica bloqueado até segunda-feira (um adulto pode repor).

---

## 6. Versão com mascote (Pip) — em teste

**Pergunta de investigação:** *faz sentido ter uma mascote que guia a criança a usar estas ferramentas?*

Pip é um ursinho amarelo que aparece no topo do ecrã (com uma barra de comida ●●●○○) e nos cartões, a falar com a criança.

| Situação | O que acontece ao Pip | Comida |
|---|---|---|
| Chega a hora da pausa | "O Pip ficou com fome de tanto saltar! Faz uma atividade para o alimentar" | −1 (só a primeira vez, não quando volta depois de adiada) |
| Atividade **bem feita** | "Nham! Obrigado por alimentares o Pip!" (fica contente) | +2 |
| Desiste da atividade (↩ Voltar) | "Não faz mal! O Pip ainda tem um bocadinho de fome" (sem ralhar) | 0 |
| Acalma-se depois de um abanão | "O Pip também está calmo" | +1 |
| Abana o telemóvel com raiva | O Pip fica assustado enquanto os controlos estão trocados | — |
| Adia a pausa ("Agora não") | Quando a pausa volta: "O Pip ainda está à espera de uma pausa…" | 0 |
| Joga muito tempo sem pausa | O Pip fica com mais fome a cada passo da fricção (10, 12, 14, 16 min) | −1 por passo |
| Pára a tempo (qualquer botão de parar, ou termina o nível nos 2 min) | "Obrigado por parares a tempo! O Pip vai dormir" | +1 |
| Acabou o tempo | "O Pip está com sono. Vamos acabar o nível e descansar!" | — |
| Os 2 minutos para terminar o nível passam | "O Pip vai dormir. Da próxima vez, vamos parar um pouco mais cedo!" | 0 |

**Atividades com o Pip:** os nomes mudam para envolver a mascote. 📷 *Show Pip a color* · 🚶 *Take Pip for a walk* · 🧘 *Breathe with Pip* · 🎤 *Sing to Pip* · 📵 *Put Pip to bed* (pousar o telemóvel = pôr o Pip a dormir).

**Humor do Pip:** 4–5 contente · 2–3 normal · 0–1 triste (mais pálido) · assustado durante o abanão · a dormir no cartão final.

**Decisões de design (para discutir nas entrevistas):**
- **O Pip nunca fica com fome enquanto o jogo está fechado.** Ao contrário de um Tamagotchi, não há nada que puxe a criança de volta ao jogo.
- O Pip **dorme no fim da sessão**: parar de jogar é apresentado como algo bom para a mascote, não como uma perda.
- Falhar, desistir ou adiar uma atividade **não tira comida**, só não dá. Só jogar muito tempo seguido sem pausa a tira.
- A comida fica guardada entre sessões e não há prémio por ter a barra cheia.

**Perguntas sugeridas para as entrevistas:**
1. A criança percebeu que as atividades alimentam o Pip? Fez as pausas mais vezes por causa disso?
2. Ficou triste ou ansiosa quando o Pip ficou com fome? (risco de culpa)
3. Ver o Pip a dormir ajudou a aceitar o fim do jogo?
4. Os pais preferem a versão com ou sem mascote? Porquê?
5. O Pip devia ter nome/aspeto escolhido pela criança?

---

## 7. Modo de teste (dev)

Abrir com `?dev` (ou ⚙ Adultos → Testing). Aparece um botão 🛠 no jogo:

- **Saltar o relógio:** Pausa, Fim próximo, Acabou o tempo, e 10/12/14/16 min sem pausa (cada passo da fricção). A sequência real acontece, seguindo as definições dos adultos.
- **Um efeito de cada vez:** cinzento, negativo, música, controlos trocados, saltos ignorados, abanão de raiva, gastar a semana.
- No PC, cada atividade tem um botão **"Skip (PC test)"**; a 📵 pode ser testada mantendo a tecla **F**.

O modo dev não gasta o tempo semanal.

**Para uma demonstração rápida numa entrevista:** abrir `?dev` → WITH PIP → NEW GAME → botão de ferramentas → Break → Put Pip to bed → pousar o telemóvel.

---

## 8. Painel dos adultos (⚙ Grown-ups)

Protegido por uma conta de multiplicar. Tudo é guardado só no próprio telemóvel.

| Grupo | Definições (valores por defeito) |
|---|---|
| Tempo | Sessão (15 min) · Pausa a cada (5 min, 0 = nunca) · Começar a abrandar (2 min antes) · Tempo por semana (120 min) |
| Atividades | 📷 câmara · 🚶 andar (20 passos) · 🧘 respirar · 🎤 cantarolar · 📵 pousar o telemóvel (60 s) |
| Cores a encontrar | vermelho, laranja, amarelo, verde, azul, roxo |
| Abrandar | Cores para cinzento · Música mais lenta / desafinada |
| Muito tempo sem pausa | Começar a fricção após (10 min sem pausa, 0 = nunca) · Negativo (+2 min) · Trocar controlos (+4 min) · Ignorar saltos (+6 min) |
| Frustração | Abanão troca os controlos |
| Mascote | 🐻 Pip (versão de teste) |
| Testing | 🛠 Modo dev |

---

## 9. Privacidade

- Nada é enviado para lado nenhum. Não há contas, servidores nem analítica.
- Câmara e microfone só são usados **durante** a atividade correspondente e desligam-se logo a seguir. As imagens são analisadas no telemóvel e não são guardadas.
- Progresso, definições, tempo semanal e comida do Pip ficam no `localStorage` do browser.

---

## 10. Para quem quer mexer no código

HTML/CSS/JavaScript sem dependências nem build. Basta abrir `index.html` através de um servidor local:

```bash
python3 -m http.server 8000
```

e ir a `http://localhost:8000/?dev`. Para testar sensores no telemóvel é preciso HTTPS (o GitHub Pages serve).

| Ficheiro | Conteúdo |
|---|---|
| `index.html` | Estrutura: canvas, HUD, comandos, ecrã inicial |
| `style.css` | Aspeto de tudo o que não é o canvas (cartões, botões, barra do tempo) |
| `levels.js` | Os 4 níveis em texto (`#` chão, `B` tijolo, `o` cubo, `^` espinhos, `E` inimigo, `F` checkpoint, `D` porta, `P` início) |
| `game.js` | Motor do jogo: física, desenho, som, comandos |
| `session.js` | Tudo o que é sessão: tempo, pausas, atividades, fricção, painel dos adultos, modo dev |
| `mascot.js` | Versão com mascote. Envolve funções do `session.js` sem as alterar; com a mascote desligada o jogo é igual à versão base |
| `gdevelop/` | Exportação dos níveis para um projeto GDevelop (só design de níveis) |

**Adicionar uma atividade de pausa:** criar uma função `nome(done, back)` em `session.js` (ver `rest` ou `calm` como exemplo), juntá-la a `ACTS` e acrescentar a opção em `DEFAULTS` e `FORM`.

Depois de alterar ficheiros, subir o número `?v=` em `index.html` para os telemóveis carregarem a versão nova.
