# Design system — Clinik.Club

Camada de produto sobre o manual de marca. O manual (`manual-da-marca.html`) responde *como a marca aparece*; este documento responde *como ela se comporta quando encontra 200 cards, 40 etiquetas e uma tabela financeira*.

**Hierarquia de fontes de verdade.** Valor de cor, logotipo e padrão gráfico: o manual. Regra de aplicação em produto (raio, densidade, estados, movimento): este documento. Implementação: `src/styles/clinik-theme.css`. Divergiu? Manual manda na cor, este doc manda na regra.

---

## 1. O que foi preservado do manual

Nada da identidade foi descartado. Continuam idênticos: o logotipo e o lettering (vetor, nunca redigitado), o ícone, o **padrão gráfico da trama**, a paleta institucional, Italiana + Jost, os tempos de movimento (180ms / 260ms), a animação dos 4 pontos, o formato do toggle com raio assinatura, as abas com indicador deslizante e o tom de voz.

O que mudou: valores de contraste que reprovavam, e a *abrangência* da assinatura de curva. Tudo o mais é adição do que não existia.

---

## 2. Cor e contraste

Correções aplicadas — texto de status ficava abaixo do mínimo de 4,5:1 justamente nos badges que o atendente lê de relance:

| Uso | Antes | Depois | Contraste |
|---|---|---|---|
| Aviso / pendente | `#9C6B3E` | `#815833` | 3,84 → 5,22 |
| Sucesso / confirmado | `#3E7A4E` | `#386D46` | 4,40 → 5,24 |
| Erro / cancelado | `#A54D42` | `#97463C` | 4,54 → 5,22 |
| Sereno sobre Névoa | `#5C6E94` | `#4F5F80` | 4,15 → 5,21 |

O Azul Sereno segue idêntico como cor decorativa e como texto sobre off-white (4,64:1). O tom `#4F5F80` ("Sereno Texto") existe apenas para quando o fundo é Névoa — chips, principalmente.

**Rampa de neutros** (não existia): a borda única `#E4E2DC` tem 1,18:1 sobre o off-white, ou seja, é invisível — num kanban isso significa colunas sem separação percebida. Seis degraus, cada um com função declarada, em `--ck-n-100` … `--ck-n-600`. Regra: escolher pelo *papel*, nunca "o cinza mais próximo".

**Etiquetas**: dez pares bg/fg dessaturados, todos ≥4,6:1. A cor é atribuída por hash estável do nome da etiqueta. O usuário **não** escolhe cor livre — é o que transforma qualquer CRM em arco-íris.

**Gráficos**: seis séries em `--ck-chart-*`, começando no navy e abrindo em matiz, não em saturação.

---

## 3. Raio — a assinatura é acento, não regra universal

Esta é a única decisão de design alterada, e a regra que a governa é sobre **repetição**, não sobre tamanho:

> A assinatura pertence ao que é singular e deliberado. Ela sai de cena onde o elemento é repetido e aninhado.

| Assinatura (`--ck-r-sig*`) | Uniforme (`--ck-r-flat*`) |
|---|---|
| Card grande, painel, modal, coluna de kanban | Card de kanban (repete 200×, aninhado) |
| Botão primário e secundário | Etiqueta, badge dentro de card |
| Input de formulário, select | Linha de tabela, item de lista |
| **Toggle** (trilho + botão) | Item de menu suspenso |
| Toast, popover | Bolha de mensagem do inbox |
| Abas (trilho) | Input inline de edição em tabela |

**Sobre o toggle** — ele mantém o raio assinatura, e é exatamente onde a assinatura deve viver. Um toggle é raro e deliberado: num painel de configurações existem cinco, dez, cada um em sua linha com rótulo. Não é um chip repetido duzentas vezes dentro de um card dentro de uma coluna. Custo de densidade zero, ganho de personalidade alto. O trilho continua sendo o retângulo curvado de `10px 3px 10px 3px` — não vira pílula.

**Bolhas de chat** merecem nota: numa conversa de 200 mensagens, cantos assimétricos criariam ruído direcional em cada linha. Uniforme, sem exceção.

O manual dizia `24px` na prosa e `20px` no CSS. Fixado em **20px**; a prosa foi corrigida.

---

## 4. Movimento — tudo mantido, com endereço definido

As três animações do manual continuam, e ganham a regra de *onde* vivem:

**Pulso dos 4 pontos do ícone** (1,2s, escalonado 0/150/300/450ms). É o detalhe mais próprio da marca e fica. Endereço: carregamento de rota, de painel e de página inteira. **Não** vai em conteúdo de lista — uma tabela recarregando 20 linhas usa esqueleto de linha, porque um logotipo pulsando dentro de cada célula é ridículo e some a informação de estrutura.

**Elevação no hover do botão** (`translateY(-2px)` + sombra, 180ms). Fica no botão primário e nas superfícies de marketing. **Não** vai em card de kanban: duzentos cards que pulam quando o mouse passa criam ruído, e durante o arraste a elevação briga com o fantasma do drag. Em listas densas, hover é mudança de fundo (`--ck-n-100`) e nada mais.

**Abas com indicador deslizante** (260ms). Fica. Uma correção de implementação: o manual assume 33,3% de largura por aba, o que só funciona com três abas de rótulo igual. Nas telas reais — Relatórios tem quatro ou cinco, com rótulos de larguras diferentes — o indicador precisa **medir a aba ativa**, não dividir por N.

**Adicionado**: `prefers-reduced-motion`. Não é opcional — há gente com sensibilidade vestibular usando isso oito horas por dia. Com a preferência ativa, transições vão a zero e o pulso dos pontos congela em opacidade cheia (o ícone não some, só para).

**A definir quando o CRM começar**: arraste no kanban (pegar, placeholder de destino, soltar), chegada de mensagem nova no inbox e estado otimista. Sem regra escrita, cada tela inventa a sua.

Nenhum movimento decorativo além do pulso. Sem parallax, sem fade-in de seção ao rolar, sem contador animado.

---

## 5. Densidade

Duas alturas de linha: confortável (44px, padrão) e compacta (36px), trocadas por `[data-density="compact"]` — **preferência do usuário, não breakpoint**. Quem opera o inbox o dia inteiro quer compacto; quem entra uma vez por semana quer confortável.

Escala de espaçamento em múltiplos de 4px. Superfície aninhada não repete o padding do pai: contêiner 20px, conteúdo interno 12px, elemento denso 8px.

---

## 6. Estados

Todo componente interativo precisa dos sete: repouso, hover, foco visível, ativo/pressionado, desabilitado, carregando e erro. Além disso, toda superfície que lista dados precisa de **vazio** e **falha** — e o vazio precisa dizer o que fazer, não só "nenhum resultado".

Foco visível é sempre o mesmo em todo o sistema: anel `0 0 0 3px` em Névoa mais borda em Azul Clinik. Nunca remover o outline sem substituir.

---

## 7. Padrão gráfico (trama)

Mantido exatamente como especificado. Tile de 88×88; o ícone entra escalado 1,17771 e transladado −14,897/−14,897 a partir da caixa normalizada 0–100, de modo que o centro de cada círculo caia no centro do vizinho — é isso que faz a trama parecer tecida e não uma grade de ícones.

Regras que continuam valendo: **sempre tom sobre tom** (nunca em cor de contraste), **sempre sangrando** a borda da peça, nunca competindo com a assinatura. Em produto, endereço: tela de login, cabeçalho de dashboard, estado vazio, fundo de card de destaque. Opacidade 5% no claro, 7% no escuro. Nunca atrás de tabela ou de texto corrido.

Implementado em `.ck-mesh` (`clinik-theme.css`), consumindo `/brand/clinik-icon.svg`.

---

## 8. Tipografia

Italiana permanece ≥24px — na prática é fonte de marketing, título de seção e estado vazio; dentro do app quem trabalha é a Jost. Ela não tem pesos além do regular, então não serve para hierarquia densa.

Jost: **400 é o piso** para corpo (o manual usava 300, frágil em tela clara) e **14px é o piso** para qualquer dado. Rótulos em caixa alta a 11px, peso 500, em `--ck-n-600` — não em Sereno, que a essa escala já pesa pouco.

Números de moeda, contagem e métrica usam `.ck-num` (`tabular-nums`). A Jost não tem figuras tabulares por padrão; sem isso toda coluna da Central de Métricas fica trêmula.

---

## 9. O que faz parecer feito por gente

Diretriz explícita: o produto deve parecer construído por um time sênior, não gerado. Na prática isso é um conjunto de proibições:

- **Densidade real.** Uma tela de CRM mostra informação. Card gigante com três palavras no meio de muito branco é sinal de gerador, não de design.
- **Sem decoração sem função.** Ícone que não ajuda a identificar a ação sai. Nada de emoji em título, sparkles, "✨ Novidades".
- **Sem gradiente decorativo**, sem vidro fosco, sem sombra colorida. A paleta é a paleta; profundidade vem de borda e dos três degraus de elevação.
- **Alinhamento óptico.** Números à direita, rótulos alinhados entre si, colunas que não dançam entre linhas.
- **Grades assimétricas quando o conteúdo pede.** Três cards idênticos lado a lado repetidos em toda tela é o padrão mais denunciador que existe.
- **Vazio, erro e carregando escritos à mão**, específicos daquela tela. Texto genérico é o segundo mais denunciador.
- **Teclado funciona.** Tab percorre na ordem visual, Esc fecha, Enter confirma, foco volta ao gatilho quando um modal fecha.
- **Microcópia na voz do manual**: afirmativa, curta, sem superlativo e sem exclamação. "Sua consulta está confirmada para quinta, às 9h" — nunca "Agendamento realizado com SUCESSO!!".
- **Erro sempre legível**, com o que fazer a seguir. Nunca stack técnico cru na cara do usuário.

---

## 10. Pendências conhecidas

**O `manual-da-marca.html` depende de `./support.js`**, um runtime do Claude Design que não vem no pacote exportado. Aberto sem internet, seções que dependem de dados (navegação, lista de arquivos, alguns swatches) aparecem como `{{ s.label }}`. Online, no Claude Design, renderiza normal. Reimplementar esse runtime não vale o custo; se o manual precisar circular offline, o caminho é exportar a versão já renderizada. Ficou registrado para não virar susto.

**Nomenclatura**: fixar "Clinik.Club" na prosa (o domínio tem o ponto). O lettering permanece como está — é arte, não texto.

**Ainda não escrito**: regras de arraste no kanban, chegada de mensagem no inbox, estado otimista, e a folha de ícones (hoje o app usa lucide; falta decidir peso e tamanho canônicos).
