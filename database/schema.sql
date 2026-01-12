-- Create Tables

CREATE TABLE IF NOT EXISTS funcionarios (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    cpf TEXT UNIQUE,
    matricula TEXT,
    cargo TEXT,
    setor TEXT,
    banco TEXT,
    agencia TEXT,
    conta TEXT,
    tipo_conta TEXT,
    chave_pix TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS epis (
    id TEXT PRIMARY KEY,
    nome TEXT,
    valor REAL,
    estoque INTEGER,
    ca_validade DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS movimentacoes_epis (
    id TEXT PRIMARY KEY,
    funcionario_id TEXT,
    itens_retirados TEXT, -- JSON Array of IDs
    itens_devolvidos TEXT, -- JSON Array of IDs
    evidencia TEXT,
    tipo_evidencia TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS descontos_epis (
    id TEXT PRIMARY KEY,
    nome_funcionario TEXT,
    cpf_funcionario TEXT,
    itens TEXT, -- JSON Array
    parcelas INTEGER,
    status TEXT DEFAULT 'pendente',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS entrevistas_desligamento (
    id TEXT PRIMARY KEY,
    nome TEXT,
    setor TEXT,
    dados TEXT, -- JSON for dynamic answers
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS recrutamento_interno (
    id TEXT PRIMARY KEY,
    nome TEXT,
    cargo_pretendido TEXT,
    setor TEXT,
    status TEXT DEFAULT 'recebido',
    observacao_rh TEXT,
    dados TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS onthejob (
    id TEXT PRIMARY KEY,
    nome_colaborador TEXT,
    empresa TEXT,
    status TEXT DEFAULT 'pendente',
    dados TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS avaliacoes (
    id TEXT PRIMARY KEY,
    tipo TEXT,
    funcionario TEXT,
    avaliador TEXT,
    dados TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS acessos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT,
    nome TEXT,
    empresa TEXT,
    documento TEXT,
    placa TEXT,
    entrada DATETIME,
    saida DATETIME
);

CREATE TABLE IF NOT EXISTS uniformes (
    id TEXT PRIMARY KEY,
    nome TEXT,
    itens TEXT, -- JSON
    status TEXT DEFAULT 'pendente',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS solicitacoes_ferias (
    id TEXT PRIMARY KEY,
    funcionario_id TEXT,
    nome TEXT,
    setor TEXT,
    inicio DATE,
    inicio2 DATE,
    tipo_gozo TEXT,
    decimo TEXT,
    gestor_email TEXT,
    nome_gestor TEXT,
    status TEXT DEFAULT 'pendente_rh',
    status_rh TEXT,
    sugestao_data DATE,
    justificativa TEXT,
    assinatura TEXT,
    signature_token TEXT,
    signed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(funcionario_id) REFERENCES funcionarios(id)
);

CREATE TABLE IF NOT EXISTS historico_solicitacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    solicitacao_id TEXT,
    data DATETIME DEFAULT CURRENT_TIMESTAMP,
    acao TEXT,
    ator TEXT,
    justificativa TEXT,
    FOREIGN KEY(solicitacao_id) REFERENCES solicitacoes_ferias(id)
);

CREATE TABLE IF NOT EXISTS taxas (
    id TEXT PRIMARY KEY,
    nome_taxa TEXT,
    cpf TEXT,
    funcao TEXT,
    forma_pagamento TEXT,
    chave_pix TEXT,
    banco TEXT,
    agencia TEXT,
    conta TEXT,
    tipo_conta TEXT,
    departamento TEXT,
    motivo TEXT, -- JSON Array
    antecessor TEXT,
    valores TEXT, -- JSON Object
    status TEXT DEFAULT 'rascunho',
    email_gestor TEXT,
    email_solicitante TEXT,
    signature_token TEXT,
    assinatura TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS candidatos (
    id TEXT PRIMARY KEY,
    nome TEXT,
    email TEXT,
    telefone TEXT,
    curriculo TEXT,
    status TEXT DEFAULT 'recebido',
    observacao TEXT,
    data_entrevista DATETIME,
    local_entrevista TEXT,
    entrevistador TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    historico TEXT, -- JSON Array for simplicity or create another table
    dados TEXT -- JSON Object for flexible fields (cargo1, etc)
);

CREATE TABLE IF NOT EXISTS vagas (
    id TEXT PRIMARY KEY,
    titulo TEXT,
    descricao TEXT,
    requisitos TEXT,
    status TEXT,
    ativa BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    departamento TEXT
);

CREATE TABLE IF NOT EXISTS movimentacoes (
    id TEXT PRIMARY KEY,
    nome_colaborador TEXT,
    setor TEXT,
    cargo TEXT,
    status TEXT DEFAULT 'pendente',
    dados TEXT, -- JSON Object for dynamic fields
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS formularios (
    id TEXT PRIMARY KEY,
    titulo TEXT,
    tipo TEXT, -- 'avaliacao', 'pesquisa', etc.
    questoes TEXT, -- JSON Array of questions
    ativo BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
