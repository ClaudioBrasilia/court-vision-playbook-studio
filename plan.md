# Simplificação do Prancheta Pro

## Objetivo

Reorganizar a interface existente para que um iniciante consiga editar uma jogada seguindo quatro etapas claras: abrir vídeo, marcar jogada, revisar e exportar. A implementação preserva a lógica atual de canvas, histórico, captura, projetos e MP4; muda principalmente a apresentação e o momento em que cada controle aparece.

## Design e UX

Foram consideradas três direções: **painel técnico compacto** (0,08), **wizard esportivo guiado** (0,06) e **estúdio profissional minimalista** (0,04). A direção escolhida é **wizard esportivo guiado**.

- **Movimento:** ferramentas de análise esportiva mobile-first, com foco no lance atual e progressão visível.
- **Princípios:** uma decisão principal por tela; controles grandes e linguagem direta; recursos avançados sob demanda; retorno fácil para a etapa anterior.
- **Cor:** manter o laranja da marca como ação principal, usar fundo escuro e contraste alto para que marcações e estados ativos sejam percebidos rapidamente.
- **Layout:** vídeo como foco central, barra de etapas no topo e painéis contextuais abaixo/ao lado; evitar expor todas as propriedades simultaneamente.
- **Elementos de assinatura:** indicador de etapa numerado, botão primário contextual e cartões de instrução curtos.
- **Interação:** abrir vídeo leva à marcação; concluir uma marcação retoma o vídeo; revisar e exportar são ações explícitas, nunca misturadas às ferramentas de desenho.
- **Animação:** transições discretas de estado e feedback imediato no botão principal; sem animações que atrapalhem a leitura do lance.
- **Tipografia:** preservar a tipografia atual, com títulos esportivos curtos e instruções em texto regular de alto contraste.
- **Essência:** uma prancheta de basquete que transforma uma jogada em feedback visual em poucos passos; clara, rápida e prática.
- **Tom:** direto e orientador. Exemplos: “Comece abrindo um vídeo” e “Desenhe sobre a jogada; o vídeo continua sozinho”.
- **Marca:** preservar PRANCHETAPRO e o laranja atual como assinatura.

## Implementação

Adicionar um estado de etapa ao componente existente: `open`, `mark`, `review` e `export`. Manter o elemento `<video>` e o canvas montados para não quebrar referências imperativas e exportação de áudio. Reorganizar o JSX para que a etapa aberta mostre entrada de vídeo/projeto; a etapa de marcação mostre vídeo, reprodução, timeline essencial e ferramentas principais; a revisão mostre lista/propriedades; e a exportação mostre trecho, formato e progresso.

As transições validam a existência de vídeo e a ausência de gravação/exportação ativa. A captura do YouTube permanece uma alternativa de entrada. Ferramentas avançadas, recorte da captura e opções detalhadas ficam em blocos recolhíveis ou dentro da etapa apropriada.

## Evolução esportiva inicial

Depois da simplificação do fluxo, a primeira camada de recursos inspirados em Onform, Hudl e Dartfish será implementada sem alterar a arquitetura principal: velocidades de reprodução de 0,25x a 1x, avanço quadro a quadro, o comando direto “Marcar este momento” e tags rápidas de basquete. As tags serão salvas no projeto JSON e reaparecerão na revisão. Narração, comparação lado a lado e rastreamento ficam para etapas posteriores, após validar o uso básico.

## Modo Social para movimentações na quadra

O objetivo imediato é criar vídeos de jogadas para postagem, com a movimentação dos jogadores como foco. A exportação passa a oferecer presets Reels/TikTok 9:16, Feed 1:1, Quadra 16:9 e Original; o usuário pode ajustar o enquadramento horizontal para manter os jogadores visíveis. O painel também permite título da jogada, contexto curto e identificação do perfil, exibidos no preview e gravados no MP4. O formato vertical é o padrão inicial, mas o preset “Quadra 16:9” fica explícito para lances em que mostrar toda a quadra é mais importante que ocupar a tela do celular.

## Otimização mobile

Em telas menores, o painel lateral de desktop é substituído por uma barra inferior fixa com áreas de toque de pelo menos 44 px, ferramentas principais e um menu para as demais ferramentas e cores. Os controles de reprodução quebram em várias linhas para não ficarem apertados. O vídeo tem um modo de foco em tela cheia para desenhar com o dedo, mantendo `touch-none` e eventos Pointer no canvas para evitar rolagem acidental durante o gesto.

## Fase 1 — Marcações animadas

As marcações devem aparecer de forma progressiva para explicar a movimentação, em vez de simplesmente surgir prontas. Setas, linhas tracejadas e linhas revelam o traçado e a ponta; o desenho livre revela os pontos gradualmente; zonas expandem até o tamanho desenhado; círculos e holofotes recebem um pulso sutil. A duração existente de cada anotação continua controlando quando ela aparece e desaparece, e a timeline permanece como o lugar para revisar esse intervalo.

## Estrutura relevante

- `src/routes/index.tsx`: estado do editor, interação do canvas, reprodução, etapas e exportação.
- `src/lib/live-trajectory.ts`: amostragem e interpolação de trajetórias ao vivo.
- `src/components/ui/*`: componentes visuais existentes, reutilizados sem trocar a base do projeto.
- `src/test/*`: testes atuais de trajetória e roteamento, preservados durante a refatoração.
