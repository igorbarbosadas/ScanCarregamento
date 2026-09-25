# Renomeador de Carregamentos - v11

Correção estrutural dos botões do popup.

O problema da versão anterior estava no JavaScript: as funções do popup ficaram fora do bloco principal do sistema. O PDF conseguia aparecer, mas os botões não conseguiam acessar corretamente os dados do arquivo.

A v11 reorganiza o JavaScript inteiro.

Agora funcionam:
- Abrir arquivo
- Fechar pelo X
- Cancelar
- Página anterior
- Próxima página
- Usar placa do relatório
- Usar placa do mapa
- Usar placa digitada

Ao confirmar uma placa:
1. o campo da tabela é atualizado;
2. o status muda para `Confirmado`;
3. o novo nome do arquivo é recalculado;
4. o popup fecha.

Formato final:
`PLACA - DD.MM.pdf`


Alteração v12:
- O nome exibido `Relatório de Carregamento` foi substituído por `Checkin` na interface.
- A lógica de leitura continua usando a mesma página/documento de origem.


Alteração v13:
- O sistema agora verifica automaticamente se cada página escaneada está de ponta cabeça.
- A detecção compara a leitura em 0° e 180°.
- O OCR usa a orientação corrigida.
- O popup também mostra a página já na orientação correta.
- A correção é feita página por página, então um mesmo PDF pode ter páginas normais e páginas invertidas.


Alteração v14:
- Detecta possível duplicidade quando placa + data coincidem.
- Calcula SHA-256 para identificar quando os PDFs são exatamente iguais.
- Abre um popup com as opções:
  - Manter os dois
  - Ignorar primeiro
  - Ignorar segundo
- Se você escolher `Manter os dois`, o arquivo mais atual recebe `ver2` no nome.
- Exemplo:
  - `RNS4A39 - 21.09.pdf`
  - `RNS4A39 - 21.09 ver2.pdf`
- Para decidir qual é o mais atual, o sistema usa `lastModified` do arquivo. Se os dois tiverem o mesmo horário, o segundo arquivo enviado recebe `ver2`.
- Arquivos marcados como ignorados não entram no ZIP.


Alteração v15:
- Para decidir qual duplicado é o mais atual, o sistema não usa mais `lastModified` do arquivo.
- Agora usa a data e o horário da linha `Impresso por` do Mapa de Carregamento.
- Exemplo:
  - Arquivo A: `Impresso por ... 21/09/2026 - 08:15:22`
  - Arquivo B: `Impresso por ... 21/09/2026 - 10:47:05`
  - O Arquivo B é considerado o mais atual e recebe `ver2`.
- O popup de duplicidade mostra o horário `Impresso por` encontrado em cada arquivo.
- Se o horário não for identificado em nenhum dos dois, o segundo arquivo enviado recebe `ver2` apenas como fallback.
