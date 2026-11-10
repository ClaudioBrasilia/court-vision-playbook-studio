# TODO — Simplificação do Prancheta Pro

## Fluxo guiado de quatro etapas

- [ ] O editor deve apresentar um fluxo claro com as etapas **Abrir vídeo**, **Marcar jogada**, **Revisar** e **Exportar**, com apenas a etapa atual em destaque.
- [ ] Antes de um vídeo válido ser carregado, a interface deve priorizar **Abrir vídeo** e **Capturar aba / YouTube**, mantendo salvar/abrir projeto como ações secundárias.
- [ ] Depois que o vídeo carregar, a interface deve levar o usuário para **Marcar jogada** e esconder opções de exportação que não são necessárias durante o desenho.
- [ ] O usuário deve conseguir voltar para a etapa anterior sem perder o vídeo, as marcações ou o estado do editor.

## Marcação simples

- [ ] A etapa de marcação deve mostrar o vídeo como foco principal, controles de Play/Pause, avanço quadro a quadro e timeline essencial.
- [ ] As ferramentas mais usadas devem ficar acessíveis sem sobrecarregar a tela; ferramentas avançadas devem ficar agrupadas em uma seção secundária.
- [ ] Ao concluir uma seta, círculo, linha ou texto, o vídeo deve continuar automaticamente por padrão, com uma opção explícita para desativar esse comportamento.
- [ ] Captura do YouTube e recorte de laterais devem permanecer disponíveis como opções da entrada/enquadramento, não como parte do conjunto principal de ferramentas de desenho.

## Revisão e exportação

- [ ] A etapa de revisão deve concentrar seleção, lista de marcações, desfazer/refazer, edição de propriedades e exclusão.
- [ ] A etapa de exportação deve concentrar início/fim do trecho, formato Original/9:16/1:1/16:9, exportação MP4, progresso e cancelamento.
- [ ] A exportação deve continuar usando o recorte e as marcações definidos no editor, sem exigir que o usuário procure configurações em painéis diferentes.

## Preservação

- [ ] A refatoração deve preservar captura, histórico, edição direta, projetos JSON, trajetória ao vivo, conversão MP4 e os testes existentes.
