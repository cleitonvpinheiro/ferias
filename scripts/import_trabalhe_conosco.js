const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database/formularios.db');
const db = new sqlite3.Database(dbPath);

const run = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(query, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
};

const get = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(query, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

const createTrabalheConoscoForm = async () => {
    const id = 'trabalhe-conosco';
    const title = 'Trabalhe Conosco - Banco de Talentos';
    
    // Check if exists
    const existing = await get('SELECT id FROM formularios WHERE id = ?', [id]);
    if (existing) {
        console.log(`Formulário ${id} já existe. Pulando.`);
        return;
    }

    const questoes = [];

    // --- Dados Pessoais ---
    questoes.push({ type: 'text', text: 'Nome do Candidato', required: true, category: 'Dados Pessoais' });
    questoes.push({ type: 'text', text: 'Naturalidade', required: true, category: 'Dados Pessoais' });
    questoes.push({ type: 'text', text: 'Data de Nascimento', required: true, category: 'Dados Pessoais', placeholder: 'DD/MM/AAAA' }); // Using text for date for now
    questoes.push({ type: 'text', text: 'Idade', required: true, category: 'Dados Pessoais' });
    questoes.push({ 
        type: 'select', 
        text: 'Estado Civil', 
        options: ['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)'], 
        category: 'Dados Pessoais' 
    });
    questoes.push({ type: 'text', text: 'Endereço', required: true, category: 'Dados Pessoais' });
    questoes.push({ type: 'text', text: 'Bairro', required: true, category: 'Dados Pessoais' });
    questoes.push({ type: 'text', text: 'Cidade', required: true, category: 'Dados Pessoais' });
    questoes.push({ type: 'text', text: 'Telefone', required: true, category: 'Dados Pessoais' });
    questoes.push({ type: 'text', text: 'Recado', required: false, category: 'Dados Pessoais' });
    questoes.push({ type: 'text', text: 'RG / RNE', required: false, category: 'Dados Pessoais' });
    questoes.push({ type: 'text', text: 'CPF', required: false, category: 'Dados Pessoais' });
    questoes.push({ 
        type: 'select', 
        text: 'Raça/Etnia', 
        options: ['Indígena', 'Branca', 'Preta', 'Parda', 'Amarela'], 
        category: 'Dados Pessoais' 
    });
    questoes.push({ type: 'text', text: 'Email', required: true, category: 'Dados Pessoais' });
    
    // Filhos
    questoes.push({ 
        type: 'yesno', 
        text: 'Filhos menores de idade?', 
        category: 'Dados Pessoais' 
    });
    questoes.push({ type: 'text', text: 'Se sim, quantos?', required: false, category: 'Dados Pessoais' });

    questoes.push({ 
        type: 'select', 
        text: 'Escolaridade', 
        options: [
            'Ensino Fundamental Completo', 
            'Ensino Fundamental Incompleto', 
            'Ensino Médio Completo', 
            'Ensino Médio Incompleto', 
            'Ensino Superior Completo', 
            'Ensino Superior Incompleto'
        ], 
        category: 'Dados Pessoais' 
    });
    questoes.push({ type: 'text', text: 'Nº do cartão VT', required: false, category: 'Dados Pessoais' });

    // --- Informações de Trabalho ---
    questoes.push({ 
        type: 'yesno', 
        text: 'Já trabalhou no Madalosso?', 
        category: 'Informações de Trabalho' 
    });
    questoes.push({ type: 'text', text: 'Qual período e função?', required: false, category: 'Informações de Trabalho' });
    
    questoes.push({ 
        type: 'select', 
        text: 'Tamanho da Camiseta', 
        options: ['P', 'M', 'G', 'GG', 'XG'], 
        category: 'Informações de Trabalho' 
    });
    questoes.push({ 
        type: 'select', 
        text: 'Tamanho da Calça', 
        options: ['P', 'M', 'G', 'GG', 'XG'], 
        category: 'Informações de Trabalho' 
    });
    questoes.push({ type: 'text', text: 'Tamanho do Sapato', required: false, category: 'Informações de Trabalho' });

    // --- Experiência Profissional (1) ---
    questoes.push({ type: 'text', text: 'Última Empresa', required: false, category: 'Experiência Profissional' });
    questoes.push({ type: 'text', text: 'Cargo (Última)', required: false, category: 'Experiência Profissional' });
    questoes.push({ type: 'text', text: 'Último Salário (Última)', required: false, category: 'Experiência Profissional' });
    questoes.push({ type: 'text', text: 'Admissão (Última)', required: false, category: 'Experiência Profissional' });
    questoes.push({ type: 'text', text: 'Saída (Última)', required: false, category: 'Experiência Profissional' });
    questoes.push({ type: 'textarea', text: 'Motivo da saída (Última)', required: false, category: 'Experiência Profissional' });

    // --- Experiência Profissional (2) ---
    questoes.push({ type: 'text', text: 'Penúltima Empresa', required: false, category: 'Experiência Profissional' });
    questoes.push({ type: 'text', text: 'Cargo (Penúltima)', required: false, category: 'Experiência Profissional' });
    questoes.push({ type: 'text', text: 'Último Salário (Penúltima)', required: false, category: 'Experiência Profissional' });
    questoes.push({ type: 'text', text: 'Admissão (Penúltima)', required: false, category: 'Experiência Profissional' });
    questoes.push({ type: 'text', text: 'Saída (Penúltima)', required: false, category: 'Experiência Profissional' });
    questoes.push({ type: 'textarea', text: 'Motivo da saída (Penúltima)', required: false, category: 'Experiência Profissional' });

    // --- Outras Informações ---
    questoes.push({ 
        type: 'select', 
        text: 'Disponibilidade de Horário', 
        options: ['Manhã', 'Tarde', 'Noite', 'Integral'], 
        category: 'Outras Informações' 
    });
    questoes.push({ type: 'text', text: 'Pretensão Salarial', required: false, category: 'Outras Informações' });

    // --- Anexo ---
    // Using 'file' type even if not fully supported yet in UI, it is semantically correct
    questoes.push({ type: 'file', text: 'Currículo (PDF, DOC, Imagem)', required: false, category: 'Anexos' });

    // --- Termo ---
    questoes.push({ 
        type: 'yesno', 
        text: 'Em observância à Lei 13.709/18 (LGPD), autorizo a empresa IRMÃOS MADALOSSO LTDA a tratar meus dados pessoais para fins de recrutamento e seleção.', 
        required: true, 
        category: 'Termo de Consentimento' 
    });

    await run(`INSERT INTO formularios (id, titulo, tipo, questoes, ativo, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, title, 'recrutamento', JSON.stringify(questoes), 1, new Date().toISOString(), new Date().toISOString()]);
    
    console.log(`Criado formulário: ${title}`);
};

createTrabalheConoscoForm()
    .then(() => {
        console.log('Importação concluída!');
        db.close();
    })
    .catch(err => {
        console.error('Erro na importação:', err);
        db.close();
    });
