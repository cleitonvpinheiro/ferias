# Sistema de Solicitação de Férias (FORM.03.RH)

Este projeto é uma aplicação web para gerenciamento do fluxo de solicitação de férias, desde o preenchimento pelo colaborador até a validação final pelo RH, incluindo assinaturas eletrônicas via Autentique.

## 🚀 Funcionalidades

- **Formulário de Solicitação:** Preenchimento de dados do colaborador, períodos de férias e solicitação de 13º salário.
- **Assinatura do Colaborador:** Assinatura manual feita diretamente na interface web (canvas).
- **Fluxo de Aprovação:**
  1.  **Colaborador:** Envia a solicitação.
  2.  **Gestor:** Recebe notificação por e-mail para aprovar ou reprovar. Assinatura realizada via **Autentique**.
  3.  **RH:** Após aprovação do gestor, recebe notificação para validação. Assinatura realizada via **Autentique**.
- **Geração de PDF:** Geração automática do formulário em PDF contendo todas as informações e assinaturas.
- **Notificações por E-mail:** Atualizações de status enviadas via SMTP.

## 🛠️ Tecnologias Utilizadas

- **Backend:** Node.js, Express
- **Frontend:** HTML5, CSS3, JavaScript (Vanilla)
- **PDF:** PDFKit
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
    Crie um arquivo `.env` na raiz do projeto e configure as seguintes chaves:

    ```env
    # Servidor
    PORT=3000
    BASE_URL=http://localhost:3000

    # Configurações de E-mail (SMTP)
    SMTP_HOST=smtp.exemplo.com.br
    SMTP_PORT=587
    SMTP_USER=seu_email@exemplo.com.br
    SMTP_PASS=sua_senha
    EMAIL_FROM=seu_email@exemplo.com.br

    # Configurações Autentique
    AUTENTIQUE_URL=https://api.autentique.com.br/v2
    AUTENTIQUE_TOKEN=seu_token_autentique
    AUTENTIQUE_MODE=dev # ou 'prod' para produção (dev usa e-mails de sandbox/log)
    
    # E-mail do RH (para assinatura)
    DP_EMAIL=rh@exemplo.com.br
    ```

## ▶️ Como Executar

Para iniciar o servidor:

```bash
npm start
```

A aplicação estará disponível em `http://localhost:3000` (ou na porta definida no `.env`).

## 📂 Estrutura do Projeto

- `public/`: Arquivos estáticos (HTML, CSS, JS, imagens).
- `data/`: Armazenamento de dados (JSON).
- `assets/`: Recursos como logos e imagens de fundo para o PDF.
- `server.js`: Ponto de entrada e lógica do servidor.
