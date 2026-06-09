-- Create Tables

CREATE TABLE IF NOT EXISTS funcionarios (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    cpf TEXT UNIQUE,
    matricula TEXT,
    cargo TEXT,
    setor TEXT,
    ativo INTEGER DEFAULT 1,
    data_admissao TEXT,
    nascimento TEXT,
    sexo TEXT,
    raca_cor TEXT,
    nacionalidade TEXT,
    tipo_vinculo TEXT,
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
    codigo_qr TEXT,
    vida_util_dias INTEGER,
    status TEXT DEFAULT 'ativo',
    possui_ca INTEGER DEFAULT 1,
    ca_validade DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_epis_codigo_qr ON epis(codigo_qr);

CREATE TABLE IF NOT EXISTS movimentacoes_epis (
    id TEXT PRIMARY KEY,
    funcionario_id TEXT,
    itens_retirados TEXT, -- JSON Array of IDs
    itens_devolvidos TEXT, -- JSON Array of IDs
    evidencia TEXT,
    tipo_evidencia TEXT,
    termo TEXT,
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

CREATE TABLE IF NOT EXISTS solicitacoes_epis (
    id TEXT PRIMARY KEY,
    funcionario_id TEXT NOT NULL,
    tipo TEXT DEFAULT 'retirada',
    itens_solicitados TEXT NOT NULL, -- JSON Array of EPI IDs (pode repetir)
    status TEXT DEFAULT 'pendente', -- pendente | atendida | cancelada
    atendido_at DATETIME,
    atendido_por TEXT,
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

CREATE TABLE IF NOT EXISTS disciplinar_registros (
    id TEXT PRIMARY KEY,
    funcionario_id TEXT NOT NULL,
    tipo TEXT NOT NULL,
    motivo TEXT,
    descricao TEXT,
    data_ocorrencia TEXT,
    dias_suspensao INTEGER,
    status VARCHAR(50) DEFAULT 'ativo',
    criado_por TEXT,
    origem TEXT,
    dados TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(funcionario_id) REFERENCES funcionarios(id)
);

CREATE TABLE IF NOT EXISTS avaliacoes (
    id TEXT PRIMARY KEY,
    tipo TEXT,
    funcionario TEXT,
    avaliador TEXT,
    dados TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS avaliacao_ciclos (
    id TEXT PRIMARY KEY,
    titulo TEXT NOT NULL,
    descricao TEXT,
    modelo TEXT DEFAULT '180',
    tipo_formulario TEXT NOT NULL,
    pesos_categoria TEXT,
    pesos_relacao TEXT,
    max_score_item REAL DEFAULT 7.7,
    data_inicio DATETIME,
    data_fim DATETIME,
    status TEXT DEFAULT 'ativo',
    criado_por TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS avaliacao_participantes (
    id TEXT PRIMARY KEY,
    ciclo_id TEXT NOT NULL,
    avaliado_id TEXT NOT NULL,
    avaliado_nome TEXT,
    avaliado_setor TEXT,
    avaliado_cargo TEXT,
    avaliador_username TEXT NOT NULL,
    avaliador_nome TEXT,
    avaliador_role TEXT,
    relacao TEXT DEFAULT 'gestor',
    peso REAL DEFAULT 1,
    status TEXT DEFAULT 'pendente',
    avaliacao_id TEXT,
    started_at DATETIME,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(ciclo_id) REFERENCES avaliacao_ciclos(id) ON DELETE CASCADE,
    FOREIGN KEY(avaliado_id) REFERENCES funcionarios(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS avaliacao_consolidado (
    id TEXT PRIMARY KEY,
    ciclo_id TEXT NOT NULL,
    avaliado_id TEXT NOT NULL,
    dados TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(ciclo_id) REFERENCES avaliacao_ciclos(id) ON DELETE CASCADE,
    FOREIGN KEY(avaliado_id) REFERENCES funcionarios(id) ON DELETE CASCADE
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

CREATE TABLE IF NOT EXISTS ciclos_uniforme (
    id TEXT PRIMARY KEY,
    funcionario_id TEXT NOT NULL,
    data_retirada DATETIME,
    data_devolucao DATETIME,
    status TEXT DEFAULT 'em_uso',
    evidencias TEXT, -- JSON
    criado_por TEXT,
    finalizado_por TEXT,
    observacoes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ciclo_itens (
    id TEXT PRIMARY KEY,
    ciclo_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    item_tipo TEXT DEFAULT 'epi',
    status_devolucao TEXT,
    evidencia_foto TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(ciclo_id) REFERENCES ciclos_uniforme(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ocorrencias_uniforme (
    id TEXT PRIMARY KEY,
    ciclo_id TEXT NOT NULL,
    tipo TEXT NOT NULL,
    status TEXT DEFAULT 'pendente',
    valor REAL,
    parcelas INTEGER,
    aprovado_por TEXT,
    dados TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(ciclo_id) REFERENCES ciclos_uniforme(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS descontos_uniforme (
    id TEXT PRIMARY KEY,
    funcionario_id TEXT,
    ocorrencia_id TEXT,
    valor_total REAL,
    parcelas INTEGER,
    status TEXT DEFAULT 'pendente',
    dados TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(ocorrencia_id) REFERENCES ocorrencias_uniforme(id)
);

CREATE TABLE IF NOT EXISTS kits_uniforme (
    id TEXT PRIMARY KEY,
    setor TEXT,
    cargo TEXT,
    itens TEXT NOT NULL, -- JSON
    ativo INTEGER DEFAULT 1,
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
    aprovador_nome TEXT,
    aprovador_username TEXT,
    approval_token TEXT,
    signature_token TEXT,
    assinatura TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS candidatos (
    id TEXT PRIMARY KEY,
    vaga_id TEXT,
    cargo TEXT,
    cpf TEXT,
    nascimento TEXT,
    endereco TEXT,
    cidade TEXT,
    estado TEXT,
    linkedin TEXT,
    pretensao TEXT,
    disponibilidade TEXT,
    origem TEXT,
    updated_at DATETIME,
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

CREATE TABLE IF NOT EXISTS movimentacoes_rh (
    id TEXT PRIMARY KEY,
    nome_colaborador TEXT,
    setor TEXT,
    cargo TEXT,
    status TEXT DEFAULT 'pendente',
    dados TEXT, -- JSON Object for dynamic fields
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS movimentacoes (
    id TEXT PRIMARY KEY,
    colaborador_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    tipo TEXT NOT NULL, -- retirada | devolucao
    status TEXT DEFAULT 'ok', -- ok | avaria | extravio
    origem TEXT NOT NULL, -- portaria | kiosk
    observacao TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(colaborador_id) REFERENCES funcionarios(id),
    FOREIGN KEY(item_id) REFERENCES epis(id)
);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_colaborador_created ON movimentacoes(colaborador_id, created_at);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_item_created ON movimentacoes(item_id, created_at);

CREATE TABLE IF NOT EXISTS formularios (
    id TEXT PRIMARY KEY,
    titulo TEXT,
    tipo TEXT, -- 'avaliacao', 'pesquisa', etc.
    questoes TEXT, -- JSON Array of questions
    ativo BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS respostas_formularios (
    id TEXT PRIMARY KEY,
    formulario_id TEXT NOT NULL,
    funcionario_id TEXT,
    respostas TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(formulario_id) REFERENCES formularios(id),
    FOREIGN KEY(funcionario_id) REFERENCES funcionarios(id)
);

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    name TEXT,
    email TEXT,
    blocked_paths TEXT, -- JSON Array of paths to block
    ativo INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS solicitacoes_taxa (
    id TEXT PRIMARY KEY,
    solicitante TEXT,
    email_solicitante TEXT,
    departamento TEXT,
    funcao_necessaria TEXT,
    motivo TEXT,
    detalhe_motivo TEXT,
    data_necessaria DATE,
    horario_inicio TEXT,
    horario_fim TEXT,
    quantidade_vagas INTEGER,
    observacoes TEXT,
    status TEXT DEFAULT 'pendente',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role TEXT PRIMARY KEY,
    protected_paths TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS intranet_posts (
    id TEXT PRIMARY KEY,
    tipo TEXT DEFAULT 'post',
    titulo TEXT,
    conteudo TEXT NOT NULL,
    imagem_url TEXT,
    autor_username TEXT,
    autor_nome TEXT,
    autor_role TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS intranet_events (
    id TEXT PRIMARY KEY,
    titulo TEXT NOT NULL,
    descricao TEXT,
    data_inicio DATETIME NOT NULL,
    data_fim DATETIME,
    local TEXT,
    criado_por TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    tipo TEXT DEFAULT 'info',
    titulo TEXT NOT NULL,
    mensagem TEXT,
    link TEXT,
    read_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS auditoria_logs (
    id TEXT PRIMARY KEY,
    request_id TEXT,
    actor_username TEXT,
    actor_role TEXT,
    origem TEXT,
    acao TEXT,
    dados TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_auditoria_created ON auditoria_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_auditoria_actor_created ON auditoria_logs(actor_username, created_at);
CREATE TABLE IF NOT EXISTS gestor_setores (
    id      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    gestor_username VARCHAR(100) NOT NULL,
    setor   VARCHAR(200) NOT NULL,
    created_at DATETIME DEFAULT NOW(),
    UNIQUE KEY uq_gestor_setor (gestor_username, setor)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS avaliacao_assinaturas (
    avaliacao_id VARCHAR(255) PRIMARY KEY,
    gestor TEXT,
    colaborador TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME,
    FOREIGN KEY (avaliacao_id) REFERENCES avaliacoes(id) ON DELETE CASCADE
);

DELETE FROM avaliacao_participantes 
WHERE ciclo_id IN (
    SELECT id FROM avaliacao_ciclos 
    WHERE criado_por = 'sistema' 
    AND tipo_formulario != 'experiencia'
);

DELETE FROM avaliacao_ciclos 
WHERE criado_por = 'sistema' 
AND tipo_formulario != 'experiencia';
