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


Alteração v16:
- Corrigida a detecção de duplicados após correção manual da placa.
- Antes, a duplicidade era verificada apenas no momento inicial do OCR.
- Se a placa do Checkin fosse corrigida depois, dois arquivos iguais podiam aparecer apenas como `Confirmado`.
- Agora a verificação é refeita quando:
  - você confirma uma placa no popup;
  - altera manualmente a placa;
  - altera manualmente a data.
- Assim, dois arquivos como `DJV5F43` em `11/09/2026` passam a ser comparados mesmo que a placa tenha sido corrigida depois do OCR.
- Se você escolher `Manter os dois`, o mais atual pela data e hora de `Impresso por` recebe `ver2`.


Alteração v17:
- `ver` agora é numeração sequencial de versão.
- Para arquivos com a mesma placa e a mesma data:
  - o mais antigo fica sem sufixo;
  - o segundo mais atual recebe `ver2`;
  - o terceiro recebe `ver3`;
  - o quarto recebe `ver4`;
  - e assim por diante.
- A ordem é definida pela data e pelo horário da linha `Impresso por`.
- Exemplo:
  - `DJV5F43 - 11.09.pdf`
  - `DJV5F43 - 11.09 ver2.pdf`
  - `DJV5F43 - 11.09 ver3.pdf`
- Se uma versão for ignorada, a numeração das versões restantes é recalculada.


Alteração v18:
- O popup de duplicidade agora abre os dois PDFs lado a lado.
- Cada lado tem navegação independente de páginas.
- Você pode comparar visualmente os documentos antes de escolher:
  - Manter os dois
  - Ignorar primeiro
  - Ignorar segundo
- A orientação corrigida de cada página também é aplicada nessa comparação.


Alteração v19:
- Botões renomeados para `Ignorar Arquivo 1` e `Ignorar Arquivo 2`.


Alteração v20:
- Adicionado zoom no popup normal do PDF.
- Controles: `-`, `+` e `Ajustar`.
- Zoom varia de 50% a 300%.
- O popup de comparação de duplicados também ganhou zoom independente para Arquivo 1 e Arquivo 2.
- Cada PDF pode ser aproximado separadamente durante a comparação.


Alteração v21:
- Corrigido o zoom visual dos PDFs.
- Antes, o canvas tinha `max-width: 100%`, o que fazia 275% e 300% parecerem quase iguais.
- Agora o canvas pode ultrapassar a largura do painel.
- Ao aumentar o zoom, o PDF realmente cresce e aparecem barras de rolagem para navegar pelo documento.
- O zoom dos dois arquivos continua independente.


Alteração v22:
- Escurecidos os botões cinza dos popups para melhorar contraste e leitura.
- Aplicado aos controles de página, zoom, ignorar arquivo, fechar e demais botões secundários.
- O botão principal laranja continua igual.
