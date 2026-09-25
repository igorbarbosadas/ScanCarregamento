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
