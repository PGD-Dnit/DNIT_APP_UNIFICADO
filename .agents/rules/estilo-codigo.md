---
trigger: always_on
---
# Diretrizes de Estilo de Código (Padrão Humano / Corporativo) - React

- Nunca utilize emojis em chamadas `console.log`, `console.info`, `console.warn`, `console.error` ou dentro de comentários de código. Utilize prefixos sóbrios entre colchetes focados no domínio da aplicação, como `[ui]`, `[state]`, `[api]`, `[arcgis]`, `[auth]`.
- Não escreva comentários conversacionais na 2ª pessoa (ex.: "seu componente", "substitua pela sua prop", "seu mapa") nem comentários narrando o que a linha de código seguinte já diz de forma óbvia (ex.: `// atualiza o estado`).
- Não utilize banners decorativos (`/* ========================= */`), listas de checkmarks no cabeçalho de arquivos ou numeração artificial de passos (`// 1º PASSO:`, `// 1.1`, `// 5.1`).
- Comente apenas decisões de domínio, regras de negócio não triviais ou *workarounds* específicos de renderização/ciclo de vida (ex: por que um `useEffect` tem certa dependência), sempre de forma curta e direta.
- Mantenha os componentes visuais coesos e delegue lógicas complexas para Custom Hooks (ex: `src/hooks`), funções utilitárias (ex: `src/utils`) ou chamadas de API (ex: `src/services`), em vez de duplicar regras de negócio e requisições dentro de cada tela.