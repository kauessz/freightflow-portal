# FreightFlow Portal — AGENTS.md

## Objetivo
Este projeto é o frontend/portal do FreightFlow.
A prioridade é consumir corretamente os contratos da API, manter UX clara e estável e evitar lógica de negócio duplicada no frontend.

## Regras de trabalho
- Não reescrever páginas ou componentes inteiros sem necessidade.
- Evoluir componentes existentes antes de recriar do zero.
- Não inventar contratos que a API não fornece.
- Não duplicar no frontend regra que deve viver no backend.
- O frontend deve ser fino em regra de negócio e forte em UX, estados e apresentação.

## Fleet Map
- O Fleet Map deve consumir dados reais vindos da API.
- Não usar mock local ou fallback fake para posição.
- Não derivar riskLevel no frontend.
- Não derivar carrier localmente se a API puder fornecer esse dado.
- Quando a posição vier estimada ou indisponível, a UX deve deixar isso explícito.

## Estados de interface
Sempre tratar:
- loading
- empty state
- error state
- degraded state (ex.: AIS indisponível, posição estimada, dado parcial)

## Contratos e compatibilidade
- Ajustar types/interfaces conforme os contratos reais da API.
- Evitar transformar silenciosamente respostas inconsistentes.
- Quando houver falha parcial, preferir exibir estado degradado ao invés de “sumir” com o item sem contexto.

## Navegação e UX
- Drawer lateral deve evoluir a estrutura existente.
- Popups, badges e indicadores devem refletir dados vindos da API.
- A interface deve ser honesta: se a posição é estimada, mostrar isso; se indisponível, mostrar isso.

## Qualidade
Antes de concluir qualquer etapa:
- identificar o comando real de build/lint/test no projeto
- validar build da parte alterada
- revisar types/interfaces impactados
- garantir que mudanças do frontend respeitam o contrato da API

## Estilo de execução esperado
1. Ler os arquivos relevantes antes de editar.
2. Entregar diagnóstico curto.
3. Informar os arquivos a alterar.
4. Implementar em sequência.
5. Validar build.
6. Resumir o que mudou e o que depende da API.

## Uso de subagentes
- Subagentes somente para leitura/auditoria/checklist.
- Não usar subagentes para editar vários componentes em paralelo.
- O agente principal implementa.