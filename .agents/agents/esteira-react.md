name: CI - Frontend React

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  qualidade-e-build:
    runs-on: ubuntu-latest

    steps:
      - name: Baixar código do repositório
        uses: actions/checkout@v4

      - name: Configurar Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22 # Ajuste para a versão do seu projeto
          cache: 'npm'

      - name: Instalar dependências (limpo)
        run: npm ci

      - name: Auditoria de segurança (trava em High/Critical)
        run: npm audit --audit-level=high

      - name: Verificar Lint
        run: npm run lint --if-present

      - name: Executar Testes Automatizados
        env:
          CI: true
        run: npm test --if-present

      - name: Gerar Build de Produção
        env:
          CI: true
          # Exemplo de variável injetada no build (cadastre em Settings > Secrets)
          VITE_API_URL: ${{ secrets.VITE_API_URL }}
        run: npm run build

      - name: Salvar artefato do build para deploy
        uses: actions/upload-artifact@v4
        with:
          name: frontend-dist
          path: dist/ # Mude para build/ se estiver usando Create React App