# Sistema de Solicitação de Férias (FORM.03.RH)

Este projeto é uma aplicação web para gerenciamento do fluxo de solicitação de férias, desde o preenchimento pelo colaborador até a validação final pelo RH, incluindo assinaturas eletrônicas via Autentique.

## 🚀 Funcionalidades

- **Formulário de Solicitação:** Preenchimento de dados do colaborador, períodos de férias e solicitação de 13º salário.
- **Assinatura do Colaborador:** Assinatura manual feita diretamente na interface web (canvas).
- **Painel do RH:**
  - Dashboard protegido por senha para gestão das solicitações.
  - Visualização de status (Pendente, Aprovado, Reprovado).
  - Exportação de dados para Excel e PDF.
  - Estatísticas de solicitações.
- **Fluxo de Aprovação:**
  1.  **Colaborador:** Envia a solicitação.
  2.  **Gestor:** Recebe notificação por e-mail para aprovar ou reprovar. Assinatura realizada via **Autentique**.
  3.  **RH:** Após aprovação do gestor, recebe notificação para validação. Assinatura realizada via **Autentique**.
- **Segurança:**
  - Autenticação Basic Auth para acesso ao painel do RH.
  - Rate Limiting para proteção contra abusos.
  - Headers de segurança (Helmet).
- **Geração de PDF:** Geração automática do formulário em PDF contendo todas as informações e assinaturas.
- **Notificações por E-mail:** Atualizações de status enviadas via SMTP.

## 🛠️ Tecnologias Utilizadas

- **Backend:** Node.js, Express
- **Frontend:** HTML5, CSS3, JavaScript (Vanilla)
- **Segurança:** Helmet, Rate Limit, Basic Auth
- **PDF:** PDFKit, jsPDF
- **Excel:** SheetJS (xlsx)
- **E-mail:** Nodemailer
- **Assinaturas Digitais:** Integração com API Autentique (GraphQL)
- **Armazenamento:** Arquivos JSON (local)

## 📋 Pré-requisitos

- [Node.js](https://nodejs.org/) (versão 14 ou superior recomendada)
- [NPM](https://www.npmjs.com/)

## 🔧 Instalação

1.  Clone o repositório:
    ```bash
    git clone <url-do-repositorio>
    cd FormFerias
    ```

2.  Instale as dependências:
    ```bash
    npm install
    ```

3.  Configure as variáveis de ambiente:
    Crie um arquivo `.env` na raiz do projeto (use `.env.example` como base) e configure as chaves:

    ```env
    # Servidor
    PORT=8080
    BASE_URL=http://localhost:8080

    # Configurações de E-mail (SMTP)
    SMTP_HOST=smtp.exemplo.com.br
    SMTP_PORT=587
    SMTP_USER=seu_email@exemplo.com.br
    SMTP_PASS=sua_senha
    EMAIL_FROM=seu_email@exemplo.com.br

    # Configurações Autentique
    AUTENTIQUE_URL=https://api.autentique.com.br/v2
    AUTENTIQUE_TOKEN=seu_token_autentique
    AUTENTIQUE_MODE=dev # ou 'prod'

    # E-mail do RH (para assinatura)
    DP_EMAIL=rh@exemplo.com.br

    # Credenciais de Acesso ao Painel RH
    RH_USER=rh
    RH_PASS=sua_senha_segura
    ```

## ▶️ Como Executar

Para iniciar o servidor:

```bash
npm start
```

A aplicação estará disponível em `http://localhost:8080`.

- **Formulário:** `/`
- **Painel RH:** `/dashboard-rh.html` (Requer autenticação)

## 📂 Estrutura do Projeto

- `public/`: Arquivos estáticos (HTML, CSS, JS, imagens).
- `data/`: Armazenamento de dados (JSON).
- `assets/`: Recursos como logos e imagens de fundo para o PDF.
- `server.js`: Ponto de entrada e lógica do servidor.
