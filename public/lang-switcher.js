(function () {
    const STORAGE_KEY = 'app_lang';
    const THEME_KEY = 'app_theme';
    const langs = [
        { code: 'pt', htmlLang: 'pt-BR', title: 'Português (Brasil)' },
        { code: 'es', htmlLang: 'es', title: 'Español (España)' },
        { code: 'en', htmlLang: 'en', title: 'English (United States)' }
    ];

    const normalize = (lang) => {
        if (lang === 'pt' || lang === 'es' || lang === 'en') return lang;
        return 'pt';
    };

    const detect = () => {
        const nav = String(navigator.language || '').toLowerCase();
        if (nav.startsWith('es')) return 'es';
        if (nav.startsWith('en')) return 'en';
        return 'pt';
    };

    const readStored = () => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) return normalize(saved);
        } catch {}
        return detect();
    };

    const translations = {
        pt: {
            solicitacao_taxa_label_evento: 'Nome do Evento',
            solicitacao_taxa_ph_evento: 'Ex: Dia das Mães, Casamento Silva...',
            solicitacao_taxa_label_substituto: 'Nome do Colaborador a ser Substituído',
            solicitacao_taxa_ph_substituto: 'Nome do funcionário que faltou ou está de férias',
            rh_title: 'Portal RH - Família Madalosso',
            rh_ferias_title: 'Dashboard RH - Férias',
            rh_taxas_title: 'Dashboard RH - Taxas',
            rh_portal_title: 'Portal do RH',
            rh_portal_subtitle: 'Selecione o módulo que deseja acessar',
            rh_nav_brand: 'Portal RH',
            rh_nav_ferias: 'Férias',
            rh_nav_pgto_taxas: 'Pgto Taxas',
            rh_nav_req_taxas: 'Req. Taxas',
            rh_nav_candidatos: 'Candidatos',
            rh_nav_recrutamento: 'Recrutamento Interno',
            rh_nav_onthejob: 'On The Job',
            rh_nav_vagas: 'Vagas',
            rh_nav_epis: 'EPIs',
            rh_nav_desligamento: 'Desligamento',
            rh_nav_avaliacoes: 'Avaliações',
            rh_nav_experiencia: 'Experiência',
            rh_nav_formularios: 'Formulários',
            rh_nav_sair: 'Sair',
            rh_dash_ferias_title: 'Gestão de Férias',
            rh_dash_ferias_subtitle: 'Gerencie as solicitações de férias dos colaboradores',
            rh_dash_last_update_now: 'Atualizado agora',
            rh_dash_stat_pending: 'Pendentes RH',
            rh_dash_stat_done: 'Concluídas',
            rh_dash_stat_rejected: 'Reprovadas',
            rh_dash_history_title: 'Histórico de Solicitações',
            rh_dash_refresh: 'Atualizar',
            rh_dash_th_colaborador: 'Colaborador',
            rh_dash_th_setor: 'Setor',
            rh_dash_th_inicio: 'Início Férias',
            rh_dash_th_status: 'Status',
            rh_dash_th_acao: 'Ação',
            rh_dash_empty_title: 'Nenhuma solicitação encontrada.',
            rh_dash_empty_desc: 'Tudo limpo por aqui! 🎉',
            rh_dash_taxas_title: 'Gestão de Taxas',
            rh_dash_taxas_subtitle: 'Acompanhe e aprove as solicitações de pagamento',
            rh_dash_taxas_stat_pending: 'Pendentes',
            rh_dash_taxas_stat_approved: 'Aprovadas',
            rh_dash_taxas_recent_title: 'Solicitações Recentes',
            rh_dash_taxas_generate_payment: 'Gerar Pagamento',
            rh_dash_taxas_th_departamento: 'Departamento',
            rh_dash_taxas_th_funcao: 'Função',
            rh_dash_taxas_th_total: 'Total',
            rh_dash_taxas_empty_title: 'Nenhuma solicitação de taxa encontrada.',
            rh_dash_taxas_empty_desc: 'As novas solicitações aparecerão aqui.',
            rh_card_ferias_title: 'Gestão de Férias',
            rh_card_ferias_desc: 'Aprovação de solicitações, visualização de calendário e histórico de férias.',
            rh_card_taxas_title: 'Pagamento de Taxas',
            rh_card_taxas_desc: 'Controle de solicitações de pagamento, aprovações e geração de comprovantes.',
            rh_card_candidatos_title: 'Banco de Talentos',
            rh_card_candidatos_desc: 'Gestão de candidatos, triagem de currículos e processos seletivos.',
            rh_card_recrutamento_title: 'Recrutamento Interno',
            rh_card_recrutamento_desc: 'Acompanhamento de candidaturas internas de colaboradores.',
            rh_card_onthejob_title: 'On The Job',
            rh_card_onthejob_desc: 'Gestão de processos de movimentação e promoção.',
            rh_card_vagas_title: 'Gestão de Vagas',
            rh_card_vagas_desc: 'Publicação e controle das vagas disponíveis no site.',
            rh_card_epis_title: 'Gestão de EPIs',
            rh_card_epis_desc: 'Catálogo de equipamentos e uniformes para controle da portaria.',
            rh_card_portaria_title: 'Portaria',
            rh_card_portaria_desc: 'Controle de entrega e devolução de EPIs por colaborador.',
            rh_card_funcionarios_title: 'Funcionários',
            rh_card_funcionarios_desc: 'Cadastro e importação de base de funcionários (CPF/Matrícula).',
            rh_card_desligamento_title: 'Desligamento',
            rh_card_desligamento_desc: 'Formulário de entrevistas de saída e relatórios.',
            rh_card_avaliacoes_title: 'Avaliações',
            rh_card_avaliacoes_desc: 'Dashboard de performance: Liderança, ADM e Operacional.',
            rh_card_experiencia_title: 'Experiências',
            rh_card_experiencia_desc: 'Acompanhamento de período de experiência (45 e 90 dias).',
            rh_card_formularios_title: 'Formulários',
            rh_card_formularios_desc: 'Criação e edição de formulários de pesquisa e avaliação.',
            rh_card_usuarios_title: 'Gestão de Usuários',
            rh_card_usuarios_desc: 'Gerenciamento de acessos e perfis do portal.',
            rh_footer: '© 2025 Família Madalosso. Acesso Restrito ao RH.',
            idx_brand: 'Portal Interno',
            idx_restricted: 'Área Restrita',
            idx_welcome: 'Bem-vindo ao Portal',
            idx_welcome_desc: 'Acesse abaixo os formulários de solicitação ou utilize o botão de acesso restrito para áreas administrativas.',
            idx_card_ferias_title: 'Solicitação de Férias',
            idx_card_ferias_desc: 'Formulário para solicitação e programação de férias dos colaboradores.',
            idx_card_vagas_title: 'Abertura de Vaga',
            idx_card_vagas_desc: 'Formulário para requisição de abertura de novas vagas de trabalho.',
            idx_card_taxas_title: 'Pagamento de Taxas',
            idx_card_taxas_desc: 'Formulário para solicitação de pagamento de taxas e VT.',
            idx_card_solicitacao_taxa_title: 'Solicitação de Taxa',
            idx_card_solicitacao_taxa_desc: 'Requisição de mão de obra extra (taxa) para eventos ou cobertura.',
            idx_card_trabalhe_title: 'Trabalhe Conosco',
            idx_card_trabalhe_desc: 'Formulário para envio de currículo e cadastro no banco de talentos.',
            idx_card_recrutamento_title: 'Recrutamento Interno',
            idx_card_recrutamento_desc: 'Formulário para candidatura interna a vagas disponíveis.',
            idx_card_onthejob_title: 'On The Job',
            idx_card_onthejob_desc: 'Formulário para processo de movimentação e promoção (On The Job).',
            idx_title: 'Portal de Formulários - Família Madalosso',
            public_back_menu: 'Voltar ao Menu',
            public_footer_rights: '© 2025 Família Madalosso. Todos os direitos reservados.',
            public_footer_rh_access: 'Acesso RH',
            public_submit: 'Enviar Solicitação',
            public_clear: 'Limpar',
            public_continue: 'Continuar',
            public_reset: 'Zerar',
            public_reload: 'Recarregar',
            public_loading: 'Carregando...',
            public_error: 'Erro',
            public_try_again: 'Tentar Novamente',
            public_section_signature: 'Assinatura do Responsável',
            public_signature_handwritten: 'Assinatura manuscrita',
            ferias_title: 'Solicitação de Férias',
            ferias_section_employee: 'Dados do Colaborador',
            ferias_section_request: 'Solicitação',
            ferias_section_signature: 'Assinatura do Colaborador',
            ferias_submit: 'Encaminhar para RH',
            vagas_title: 'Formulário Abertura de Vaga',
            vagas_section_general: 'Dados Gerais',
            vagas_section_reason: 'Motivo da Contratação',
            vagas_section_hiring: 'Contratação',
            vagas_section_profile: 'Perfil da Vaga',
            vagas_section_requester: 'Dados do Solicitante',
            taxas_title: 'Formulário de Pagamento de Taxas',
            taxas_section_fee: 'Dados da Taxa',
            taxas_section_banking: 'Dados Bancários',
            taxas_section_reason: 'Motivo',
            taxas_submit_another: 'Enviar e Preencher Outra',
            solicitacao_taxa_title: 'Solicitação de Mão de Obra',
            solicitacao_taxa_subtitle: 'Requisição de taxa extra para eventos, cobertura ou aumento de demanda.',
            onthejob_title: 'FORMULÁRIO ON THE JOB',
            onthejob_section_initial: 'Dados Iniciais',
            onthejob_section_compare: 'Comparativo',
            onthejob_submit: 'Enviar Formulário',
            onthejob_label_colaborador: 'Colaborador',
            onthejob_select_colaborador_placeholder: 'Selecione um colaborador...',
            onthejob_label_empresa: 'Empresa',
            onthejob_placeholder_empresa: 'Unidade/Empresa',
            onthejob_label_data_proposta: 'Data da Proposta',
            onthejob_label_vigorar_inicio: 'Vigorar a partir de',
            onthejob_label_vigorar_fim: 'Até',
            onthejob_table_header_info: 'Informações',
            onthejob_table_header_atual: 'Atual',
            onthejob_table_header_proposta: 'Proposta',
            onthejob_field_cargo: 'Cargo:',
            onthejob_field_horario: 'Horário:',
            onthejob_field_setor: 'Setor:',
            onthejob_field_obs: 'Observação:',
            onthejob_section_details: 'Detalhes da Movimentação',
            onthejob_label_nivel: 'Nível da Movimentação/Promoção:',
            onthejob_opt_junior: 'Júnior',
            onthejob_opt_pleno: 'Pleno',
            onthejob_opt_senior: 'Sênior',
            onthejob_label_faixa: 'Faixa de Enquadramento salário:',
            onthejob_label_processo: 'O Processo de ON THE JOB se encaixa:',
            onthejob_opt_promocao: 'Promoção',
            onthejob_opt_mudanca: 'Mudança de Função',
            onthejob_opt_enquadramento: 'Enquadramento',
            onthejob_label_jornada: 'Jornada semanal:',
            onthejob_opt_flexivel: 'Flexível',
            onthejob_opt_44h: '44h',
            onthejob_opt_confianca: 'Cargo de Confiança',
            onthejob_opt_horista: 'Horista',
            onthejob_label_exame: 'Será necessário realizar exame de mudança de função:',
            onthejob_opt_sim: 'Sim',
            onthejob_opt_nao: 'Não',
            onthejob_opt_na: 'N/A',
            onthejob_section_salary: 'Alteração Salarial',
            onthejob_salary_header_info: 'Informações / Data',
            onthejob_salary_header_de: 'De: Atual (R$)',
            onthejob_salary_header_para: 'Para: Proposta (R$)',
            onthejob_salary_label: 'Salário:',
            onthejob_section_benefits: 'Benefícios',
            onthejob_beneficio: 'Benefício',
            onthejob_imediato: 'Imediato',
            onthejob_apos90: 'Após 90 dias',
            onthejob_apos180: 'Após 180 dias',
            recrutamento_title: 'Recrutamento Interno',
            recrutamento_section_job: 'Dados da Vaga',
            recrutamento_section_employee: 'Dados do Colaborador',
            recrutamento_section_education: 'Formação Acadêmica',
            recrutamento_section_courses: 'Cursos Complementares',
            recrutamento_section_expectations: 'Expectativas',
            recrutamento_section_availability: 'Disponibilidade',
            recrutamento_submit: 'Enviar Candidatura',
            avaliacao_operacional_title: 'Avaliação de Performance - Operacional',
            avaliacao_operacional_subtitle: 'Formulário de avaliação para equipe operacional',
            avaliacao_adm_title: 'Avaliação de Performance - Administrativo',
            avaliacao_adm_subtitle: 'Formulário de avaliação para equipe administrativa',
            avaliacao_lideranca_title: 'Avaliação de Performance - Liderança',
            avaliacao_lideranca_subtitle: 'Formulário de avaliação de gestores e líderes',
            avaliacao_submit: 'Enviar Avaliação',
            avaliacao_experiencia_title: 'AVALIAÇÃO DE EXPERIÊNCIA',
            avaliacao_experiencia_subtitle: 'Acompanhamento de 45 e 90 dias',
            avaliacao_experiencia_submit: '💾 Salvar Avaliação (45 Dias)',
            login_title: 'Acesso Restrito',
            login_username: 'Usuário',
            login_password: 'Senha',
            login_submit: 'Entrar',
            login_go_portal: 'Ir para o Portal',
            epi_title: 'Solicitação de EPI',
            epi_subtitle: 'Informe CPF ou matrícula e selecione os EPIs desejados',
            epi_section_id: 'Identificação',
            epi_placeholder_doc: 'CPF ou matrícula',
            epi_section_employee: 'Colaborador',
            epi_not_identified: 'Não identificado',
            epi_section_search: 'Buscar EPI',
            epi_placeholder_search: 'Digite nome do EPI...',
            epi_no_password: 'Esta tela não exige senha.',
            epi_available: 'EPIs disponíveis',
            epi_new_employee: 'Novo colaborador',
            trabalhe_title: 'Banco de Talentos',
            trabalhe_mark: 'RECRUTAMENTO',
            formTitle: 'Formulário de Recrutamento',
            formNote: 'Preencha os dados abaixo para se candidatar.',
            personalData: 'Dados Pessoais',
            candidateName: 'Nome do Candidato:',
            naturalidade: 'Naturalidade:',
            birthDate: 'Data de Nascimento:',
            age: 'Idade:',
            civilStatus: 'Estado Civil:',
            address: 'Endereço:',
            neighborhood: 'Bairro:',
            city: 'Cidade:',
            phone: 'Telefone:',
            recado: 'Recado:',
            rg: 'RG / RNE:',
            cpf: 'CPF:',
            race: 'Raça/Etnia:',
            email: 'Email:',
            children: 'Filhos menores de idade?',
            childrenQuantity: 'Se sim, quantos?',
            education: 'Escolaridade:',
            vtCardNumber: 'Nº do cartão VT:',
            workInformation: 'Informações de Trabalho',
            worked: 'Já trabalhou no Madalosso?',
            periodAndFunction: 'Qual período e função?',
            shirt: 'Camiseta:',
            pants: 'Calça:',
            shoe: 'Sapato (nº):',
            professionalExperience: 'Experiência Profissional',
            lastCompany: 'Última Empresa:',
            penultimateCompany: 'Penúltima Empresa:',
            cargo: 'Cargo:',
            lastSalary: 'Último Salário:',
            admission: 'Admissão:',
            departure: 'Saída:',
            reasonForDeparture: 'Motivo da saída:',
            otherInformation: 'Outras Informações',
            availability: 'Disponibilidade de Horário:',
            salaryPretension: 'Pretensão Salarial:',
            attachResume: 'Anexe seu Currículo',
            consentTerm: 'Termo de Consentimento',
            consentText: 'Em observância à Lei 13.709/18 (LGPD), autorizo a empresa IRMÃOS MADALOSSO LTDA a tratar meus dados pessoais para fins de recrutamento e seleção.',
            authorizeTreatment: 'Autorizo o tratamento dos meus dados',
            send: 'Enviar Candidatura',
            responder_form_loading: 'Carregando formulário...',
            responder_form_submit: 'Enviar Respostas',
            responder_form_success_title: 'Formulário Enviado!',
            responder_form_success_desc: 'Suas respostas foram registradas com sucesso.',
            responder_form_fill_again: 'Preencher Novamente',
            responder_form_type_avaliacao: 'Avaliação de Desempenho',
            responder_form_type_pesquisa: 'Pesquisa / Formulário',
            responder_form_answer_placeholder: 'Sua resposta...',
            responder_form_select_placeholder: 'Selecione uma opção...',
            responder_form_yes: 'Sim',
            responder_form_no: 'Não',
            responder_form_file_formats: 'Formatos aceitos: PDF, DOC, DOCX, Imagem (Máx 5MB)',
            responder_form_required_field: 'Este campo é obrigatório',
            responder_form_sending: 'Enviando...',
            responder_form_alert_title: 'Atenção',
            responder_form_alert_required: 'Por favor, verifique os campos obrigatórios.',
            responder_form_error_title: 'Erro',
            responder_form_error_connection: 'Erro de conexão',
            responder_form_error_file_too_big: 'O arquivo excede 5MB.',
            responder_form_error_send: 'Erro ao enviar respostas',
            responder_form_error_no_id: 'ID do formulário não fornecido.',
            responder_form_no_questions: 'Este formulário não possui questões.',
            rh_dash_back_portal: 'Voltar ao Portal',
            rh_dash_select: 'Selecione...',
            rh_dash_save: 'Salvar',
            rh_dash_th_nome: 'Nome',
            rh_dash_usuarios_title: 'Gestão de Usuários',
            rh_dash_usuarios_subtitle: 'Gerencie o acesso ao Portal RH',
            rh_dash_usuarios_import_ldap: 'Importar LDAP',
            rh_dash_usuarios_new: 'Novo Usuário',
            rh_dash_usuarios_form_new: 'Novo Usuário',
            rh_dash_usuarios_label_username: 'Usuário (Login)',
            rh_dash_usuarios_placeholder_username: 'ex: joao.silva',
            rh_dash_usuarios_label_name: 'Nome Completo',
            rh_dash_usuarios_placeholder_name: 'ex: João Silva',
            rh_dash_usuarios_label_password: 'Senha',
            rh_dash_usuarios_password_hint_new: 'Obrigatório para novos usuários',
            rh_dash_usuarios_label_role: 'Perfil de Acesso',
            rh_dash_usuarios_th_username: 'Usuário',
            rh_dash_usuarios_th_role: 'Perfil',
            rh_dash_usuarios_th_created: 'Criado em',
            rh_exit_form_title: 'Entrevista de Desligamento',
            rh_exit_form_subtitle: 'Por favor, preencha as informações abaixo.',
            rh_exit_form_section_type: 'TIPO DE DESLIGAMENTO',
            rh_exit_form_section_reason: 'MOTIVO DO DESLIGAMENTO',
            rh_exit_form_section_final: 'PERGUNTAS FINAIS',
            rh_exit_form_submit: 'Enviar Entrevista',
            rh_dash_filter_all: 'Todos',
            rh_dash_loading: 'Carregando...',
            rh_dash_th_data: 'Data',
            rh_dash_th_cpf: 'CPF',
            rh_dash_th_cargo: 'Cargo',
            rh_dash_th_admissao: 'Admissão',
            rh_dash_search: 'Buscar',
            rh_dash_type: 'Tipo',
            rh_dash_status: 'Status',
            rh_dash_status_active: 'Ativo',
            rh_dash_status_inactive: 'Inativo',
            rh_dash_clear: 'Limpar',
            rh_dash_preview: 'Visualizar',
            rh_dash_settings: 'Configurações',
            rh_dash_add: 'Adicionar',
            rh_dash_preview_title: 'Pré-visualização',
            rh_dash_close: 'Fechar',
            rh_dash_export_excel: 'Exportar Excel',
            rh_dash_instructions: 'Instruções',
            rh_dash_candidatos_title: 'Gestão de Candidatos',
            rh_dash_candidatos_subtitle: 'Acompanhe o fluxo de recrutamento e seleção',
            rh_dash_candidatos_search_label: 'Buscar Candidato',
            rh_dash_candidatos_search_placeholder: 'Nome, email ou cargo...',
            rh_dash_candidatos_filter_label: 'Filtrar por Vaga/Cargo',
            rh_dash_candidatos_filter_all: 'Todos os Cargos',
            rh_dash_candidatos_loading: 'Carregando candidatos...',
            rh_dash_recrutamento_title: 'Recrutamento Interno',
            rh_dash_recrutamento_subtitle: 'Acompanhe as candidaturas internas',
            rh_dash_recrutamento_search_label: 'Buscar Candidato',
            rh_dash_recrutamento_search_placeholder: 'Nome ou Cargo Pretendido...',
            rh_dash_recrutamento_loading: 'Carregando candidaturas...',
            rh_dash_recrutamento_th_data: 'Data',
            rh_dash_recrutamento_th_cargo_atual: 'Cargo Atual',
            rh_dash_recrutamento_th_cargo_pretendido: 'Cargo Pretendido',
            rh_dash_req_taxas_title: 'Requisições de Taxa',
            rh_dash_req_taxas_subtitle: 'Autorização prévia para contratação de mão de obra extra',
            rh_dash_req_taxas_recent_title: 'Solicitações Recentes',
            rh_dash_req_taxas_th_data: 'Data Nec.',
            rh_dash_req_taxas_th_solicitante: 'Solicitante',
            rh_dash_req_taxas_th_depto: 'Depto',
            rh_dash_req_taxas_th_motivo: 'Motivo',
            rh_dash_req_taxas_th_vagas: 'Vagas',
            rh_dash_req_taxas_th_acoes: 'Ações',
            rh_dash_vagas_title: 'Gestão de Vagas',
            rh_dash_vagas_subtitle: 'Controle as vagas abertas e candidatos inscritos',
            rh_dash_vagas_stat_open: 'Vagas Abertas',
            rh_dash_vagas_stat_candidates: 'Candidatos Total',
            rh_dash_vagas_stat_closed: 'Encerradas',
            rh_dash_vagas_stat_cancelled: 'Canceladas',
            rh_dash_vagas_tab_open: 'Vagas Abertas',
            rh_dash_vagas_tab_closed: 'Encerradas / Canceladas',
            rh_dash_vagas_active_title: 'Vagas Ativas',
            rh_dash_vagas_new: 'Nova Vaga',
            rh_dash_vagas_th_titulo: 'Título da Vaga',
            rh_dash_vagas_th_candidatos: 'Candidatos',
            rh_dash_vagas_empty_active: 'Nenhuma vaga ativa no momento.',
            rh_dash_vagas_history_title: 'Histórico de Vagas',
            rh_dash_vagas_empty_history: 'Nenhuma vaga encerrada.',
            rh_dash_vagas_modal_suggestions: 'Candidatos Sugeridos',
            rh_dash_desligamento_title: 'Entrevistas de Desligamento',
            rh_dash_desligamento_subtitle: 'Gerencie e visualize as entrevistas de saída',
            rh_dash_desligamento_open_form: 'Abrir Formulário para Colaborador',
            rh_dash_desligamento_history: 'Histórico de Entrevistas',
            rh_dash_desligamento_th_tipo: 'Tipo',
            rh_dash_desligamento_th_motivo: 'Motivo',
            rh_dash_epis_title: 'Gestão de EPIs',
            rh_dash_epis_subtitle: 'Cadastre os equipamentos e valores para controle da portaria',
            rh_dash_epis_stat_total_stock: 'Total em Estoque',
            rh_dash_epis_stat_low_stock: 'Estoque Baixo',
            rh_dash_epis_stat_total_value: 'Valor Total',
            rh_dash_epis_label_nome: 'Nome do EPI',
            rh_dash_epis_placeholder_nome: 'Ex: Capacete de Segurança',
            rh_dash_epis_label_valor: 'Valor (R$)',
            rh_dash_epis_placeholder_valor: '0.00',
            rh_dash_epis_label_estoque: 'Estoque Inicial',
            rh_dash_epis_placeholder_estoque: '0',
            rh_dash_epis_label_ca: 'Validade do CA',
            rh_dash_epis_add: 'Adicionar EPI',
            rh_dash_epis_import_excel: 'Importar Excel',
            rh_dash_epis_terms_title: 'Termos de Desconto',
            rh_dash_epis_terms_subtitle: 'Gerenciamento de descontos gerados pela portaria',
            rh_dash_epis_terms_loading: 'Carregando termos...',
            rh_dash_epis_mov_title: 'Histórico de Movimentações',
            rh_dash_epis_mov_subtitle: 'Registro de retiradas e devoluções na portaria',
            rh_dash_epis_mov_loading: 'Carregando movimentações...',
            rh_dash_epis_modal_evidence: 'Evidência',
            rh_dash_funcionarios_title: 'Gestão de Funcionários',
            rh_dash_funcionarios_subtitle: 'Importe a base de dados para validação de biometria e cadastro',
            rh_dash_funcionarios_sync_questor: 'Sincronizar Questor',
            rh_dash_funcionarios_download_template: 'Baixar Modelo Excel',
            rh_dash_funcionarios_upload_hint: 'Clique para importar Excel/CSV',
            rh_dash_funcionarios_inst_cols: 'O arquivo deve conter as colunas: <strong>Nome, CPF, Cargo, Setor, Data Admissão</strong>.',
            rh_dash_funcionarios_inst_cpf: 'O CPF deve conter apenas números ou pontuação padrão.',
            rh_dash_funcionarios_inst_replace: 'Esta importação <strong>substitui/atualiza</strong> a base existente.',
            rh_dash_onthejob_title: 'On The Job',
            rh_dash_onthejob_subtitle: 'Acompanhe as propostas de movimentação',
            rh_dash_onthejob_new: 'Novo On The Job',
            rh_dash_onthejob_search_label: 'Buscar Colaborador',
            rh_dash_onthejob_search_placeholder: 'Nome ou Empresa...',
            rh_dash_onthejob_loading: 'Carregando propostas...',
            rh_dash_onthejob_th_empresa: 'Empresa',
            rh_dash_onthejob_th_cargo_proposto: 'Cargo Proposto',
            rh_dash_onthejob_th_vigorar: 'Vigorar em',
            rh_dash_avaliacoes_title: 'Avaliações de Performance',
            rh_dash_avaliacoes_subtitle: 'Acompanhe as avaliações de Liderança, ADM e Operacional',
            rh_dash_avaliacoes_search_label: 'Buscar Funcionário',
            rh_dash_avaliacoes_search_placeholder: 'Nome...',
            rh_dash_avaliacoes_type_label: 'Tipo de Avaliação',
            rh_dash_avaliacoes_type_leadership: 'Liderança',
            rh_dash_avaliacoes_type_admin: 'Administrativo',
            rh_dash_avaliacoes_type_operational: 'Operacional',
            rh_dash_avaliacoes_kpi_total: 'Total de Avaliações',
            rh_dash_avaliacoes_kpi_avg: 'Média Geral',
            rh_dash_avaliacoes_kpi_approved: 'Aprovados (>80%)',
            rh_dash_avaliacoes_kpi_attention: 'Em Atenção (<50%)',
            rh_dash_avaliacoes_chart_dist: 'Distribuição por Tipo',
            rh_dash_avaliacoes_chart_avg: 'Média de Pontuação por Tipo',
            rh_dash_avaliacoes_th_funcionario: 'Funcionário',
            rh_dash_avaliacoes_th_tipo: 'Tipo',
            rh_dash_avaliacoes_th_avaliador: 'Avaliador',
            rh_dash_avaliacoes_th_pontuacao: 'Pontuação',
            rh_dash_avaliacoes_modal_title: 'Detalhes da Avaliação',
            rh_dash_experiencia_title: 'Avaliações de Experiência',
            rh_dash_experiencia_subtitle: 'Acompanhamento de 45 e 90 dias',
            rh_dash_experiencia_new: 'Nova Avaliação',
            rh_dash_experiencia_chip_title: 'Visão Gestor',
            rh_dash_experiencia_chip_desc: 'Mostra apenas quem está em alerta',
            rh_dash_experiencia_filter_stability: 'Estabilidade',
            rh_dash_experiencia_stability_probation: 'Em experiência',
            rh_dash_experiencia_stability_stable: 'Com estabilidade',
            rh_dash_experiencia_stat_next_45: 'Próximos 45 dias',
            rh_dash_experiencia_stat_next_90: 'Próximos 90 dias',
            rh_dash_experiencia_stat_overdue_45: 'Em atraso 45 dias',
            rh_dash_experiencia_stat_overdue_90: 'Em atraso 90 dias',
            rh_dash_experiencia_th_created: 'Data Criação',
            rh_dash_experiencia_th_status_45: 'Status 45 Dias',
            rh_dash_experiencia_th_status_90: 'Status 90 Dias',
            rh_dash_experiencia_th_deadline_45: 'Prazo 45 Dias',
            rh_dash_experiencia_th_deadline_90: 'Prazo 90 Dias',
            rh_dash_experiencia_th_stability: 'Estabilidade',
            rh_dash_formularios_title: 'Gestão de Formulários',
            rh_dash_formularios_subtitle: 'Crie e edite formulários de avaliação e pesquisa',
            rh_dash_formularios_new: 'Novo Formulário',
            rh_dash_formularios_search_placeholder: 'Buscar por ID ou título',
            rh_dash_formularios_th_title: 'Título',
            rh_dash_formularios_th_questions: 'Questões',
            rh_dash_formularios_empty: 'Nenhum formulário encontrado.',
            rh_dash_formularios_empty_cta: 'Criar Primeiro Formulário',
            rh_dash_formularios_modal_title: 'Editar Formulário',
            rh_dash_formularios_label_title: 'Título do Formulário',
            rh_dash_formularios_placeholder_title: 'Ex: Avaliação de Clima',
            rh_dash_formularios_type_perf: 'Avaliação de Desempenho',
            rh_dash_formularios_type_climate: 'Pesquisa de Clima',
            rh_dash_formularios_type_checklist: 'Checklist',
            rh_dash_formularios_active: 'Formulário Ativo',
            rh_dash_formularios_save_form: 'Salvar Formulário',
            rh_dash_formularios_questions: 'Questões',
            rh_dash_formularios_inline_preview: 'Prévia do Formulário',
            rh_dash_formularios_add_question_hint: 'Clique para adicionar uma nova questão',
            rh_portaria_requests: 'Solicitações',
            rh_portaria_panel: 'Painel',
            rh_portaria_stock: 'Gestão de Estoque',
            rh_portaria_kiosk_title: 'Ponto / EPI',
            rh_portaria_kiosk_subtitle: 'Digite o CPF ou Matrícula',
            rh_portaria_enter: 'ENTRAR',
            rh_portaria_stock_title: 'Gestão de Estoque - Portaria',
            rh_portaria_requests_title: 'Solicitações de EPI',
            rh_portaria_requests_search: 'Buscar por nome, CPF, matrícula ou EPI...',
            rh_portaria_deliver: 'ENTREGAR (Retirada)',
            rh_portaria_search_epi: 'Buscar EPI...',
            rh_portaria_return: 'DEVOLVER (Retorno)',
            rh_portaria_search_possession: 'Buscar em posse...',
            rh_portaria_pill_pickup: 'Retirada',
            rh_portaria_pill_return: 'Devolução',
            rh_portaria_cancel: 'Cancelar',
            rh_portaria_confirm: 'CONFIRMAR',
            rh_portaria_confirm_title: 'Confirmação Biométrica',
            rh_portaria_confirm_desc: 'Solicite ao funcionário para confirmar a operação.',
            rh_portaria_tab_signature: 'Assinatura Digital',
            rh_portaria_tab_facial: 'Reconhecimento Facial',
            rh_portaria_clear: 'Limpar',
            rh_portaria_sign_hint: 'Assine na área acima',
            rh_portaria_camera_on: 'Ativar Câmera'
        },
        es: {
            solicitacao_taxa_label_evento: 'Nombre del Evento',
            solicitacao_taxa_ph_evento: 'Ej.: Día de la Madre, Boda Silva...',
            solicitacao_taxa_label_substituto: 'Nombre del Colaborador a Sustituir',
            solicitacao_taxa_ph_substituto: 'Nombre del empleado que faltó o está de vacaciones',
            rh_title: 'Portal RR. HH. - Familia Madalosso',
            rh_ferias_title: 'Panel RR. HH. - Vacaciones',
            rh_taxas_title: 'Panel RR. HH. - Tasas',
            rh_portal_title: 'Portal de RR. HH.',
            rh_portal_subtitle: 'Selecciona el módulo al que deseas acceder',
            rh_nav_brand: 'Portal RR. HH.',
            rh_nav_ferias: 'Vacaciones',
            rh_nav_pgto_taxas: 'Pago de Tasas',
            rh_nav_req_taxas: 'Solic. Tasas',
            rh_nav_candidatos: 'Candidatos',
            rh_nav_recrutamento: 'Reclutamiento Interno',
            rh_nav_onthejob: 'On The Job',
            rh_nav_vagas: 'Vacantes',
            rh_nav_epis: 'EPIs',
            rh_nav_desligamento: 'Baja',
            rh_nav_avaliacoes: 'Evaluaciones',
            rh_nav_experiencia: 'Experiencia',
            rh_nav_formularios: 'Formularios',
            rh_nav_sair: 'Salir',
            rh_dash_ferias_title: 'Gestión de Vacaciones',
            rh_dash_ferias_subtitle: 'Gestiona las solicitudes de vacaciones de los colaboradores',
            rh_dash_last_update_now: 'Actualizado ahora',
            rh_dash_stat_pending: 'Pendientes RR. HH.',
            rh_dash_stat_done: 'Finalizadas',
            rh_dash_stat_rejected: 'Rechazadas',
            rh_dash_history_title: 'Historial de Solicitudes',
            rh_dash_refresh: 'Actualizar',
            rh_dash_th_colaborador: 'Colaborador',
            rh_dash_th_setor: 'Sector',
            rh_dash_th_inicio: 'Inicio Vacaciones',
            rh_dash_th_status: 'Estado',
            rh_dash_th_acao: 'Acción',
            rh_dash_empty_title: 'No se encontraron solicitudes.',
            rh_dash_empty_desc: '¡Todo limpio por aquí! 🎉',
            rh_dash_taxas_title: 'Gestión de Tasas',
            rh_dash_taxas_subtitle: 'Sigue y aprueba las solicitudes de pago',
            rh_dash_taxas_stat_pending: 'Pendientes',
            rh_dash_taxas_stat_approved: 'Aprobadas',
            rh_dash_taxas_recent_title: 'Solicitudes Recientes',
            rh_dash_taxas_generate_payment: 'Generar Pago',
            rh_dash_taxas_th_departamento: 'Departamento',
            rh_dash_taxas_th_funcao: 'Función',
            rh_dash_taxas_th_total: 'Total',
            rh_dash_taxas_empty_title: 'No se encontraron solicitudes de tasa.',
            rh_dash_taxas_empty_desc: 'Las nuevas solicitudes aparecerán aquí.',
            rh_card_ferias_title: 'Gestión de Vacaciones',
            rh_card_ferias_desc: 'Aprobación de solicitudes, vista de calendario e historial de vacaciones.',
            rh_card_taxas_title: 'Pago de Tasas',
            rh_card_taxas_desc: 'Control de solicitudes de pago, aprobaciones y generación de comprobantes.',
            rh_card_candidatos_title: 'Banco de Talentos',
            rh_card_candidatos_desc: 'Gestión de candidatos, selección de currículums y procesos selectivos.',
            rh_card_recrutamento_title: 'Reclutamiento Interno',
            rh_card_recrutamento_desc: 'Seguimiento de candidaturas internas de colaboradores.',
            rh_card_onthejob_title: 'On The Job',
            rh_card_onthejob_desc: 'Gestión de procesos de movilidad y promoción.',
            rh_card_vagas_title: 'Gestión de Vacantes',
            rh_card_vagas_desc: 'Publicación y control de vacantes disponibles en el sitio.',
            rh_card_epis_title: 'Gestión de EPIs',
            rh_card_epis_desc: 'Catálogo de equipos y uniformes para control de portería.',
            rh_card_portaria_title: 'Portería',
            rh_card_portaria_desc: 'Control de entrega y devolución de EPIs por colaborador.',
            rh_card_funcionarios_title: 'Empleados',
            rh_card_funcionarios_desc: 'Registro e importación de base de empleados (CPF/Matrícula).',
            rh_card_desligamento_title: 'Salida',
            rh_card_desligamento_desc: 'Formulario de entrevistas de salida e informes.',
            rh_card_avaliacoes_title: 'Evaluaciones',
            rh_card_avaliacoes_desc: 'Panel de desempeño: Liderazgo, Administrativo y Operacional.',
            rh_card_experiencia_title: 'Experiencia',
            rh_card_experiencia_desc: 'Seguimiento del período de prueba (45 y 90 días).',
            rh_card_formularios_title: 'Formularios',
            rh_card_formularios_desc: 'Creación y edición de formularios de encuesta y evaluación.',
            rh_card_usuarios_title: 'Gestión de Usuarios',
            rh_card_usuarios_desc: 'Gestión de accesos y perfiles del portal.',
            rh_footer: '© 2025 Familia Madalosso. Acceso restringido a RR. HH.',
            idx_brand: 'Portal Interno',
            idx_restricted: 'Área Restringida',
            idx_welcome: 'Bienvenido al Portal',
            idx_welcome_desc: 'Accede a los formularios abajo o usa el botón de acceso restringido para áreas administrativas.',
            idx_card_ferias_title: 'Solicitud de Vacaciones',
            idx_card_ferias_desc: 'Formulario para solicitud y programación de vacaciones de los colaboradores.',
            idx_card_vagas_title: 'Apertura de Vacante',
            idx_card_vagas_desc: 'Formulario para solicitud de apertura de nuevas vacantes de trabajo.',
            idx_card_taxas_title: 'Pago de Tasas',
            idx_card_taxas_desc: 'Formulario para solicitud de pago de tasas y transporte.',
            idx_card_solicitacao_taxa_title: 'Solicitud de Tasa',
            idx_card_solicitacao_taxa_desc: 'Solicitud de mano de obra extra (tasa) para eventos o cobertura.',
            idx_card_trabalhe_title: 'Trabaja con Nosotros',
            idx_card_trabalhe_desc: 'Formulario para envío de currículum y registro en la bolsa de talentos.',
            idx_card_recrutamento_title: 'Reclutamiento Interno',
            idx_card_recrutamento_desc: 'Formulario para candidatura interna a vacantes disponibles.',
            idx_card_onthejob_title: 'On The Job',
            idx_card_onthejob_desc: 'Formulario para proceso de movimiento y promoción (On The Job).',
            idx_title: 'Portal de Formularios - Familia Madalosso',
            public_back_menu: 'Volver al Menú',
            public_footer_rights: '© 2025 Familia Madalosso. Todos los derechos reservados.',
            public_footer_rh_access: 'Acceso RR. HH.',
            public_submit: 'Enviar Solicitud',
            public_clear: 'Limpiar',
            public_continue: 'Continuar',
            public_reset: 'Reiniciar',
            public_reload: 'Recargar',
            public_loading: 'Cargando...',
            public_error: 'Error',
            public_try_again: 'Intentar de Nuevo',
            public_section_signature: 'Firma del Responsable',
            public_signature_handwritten: 'Firma manuscrita',
            ferias_title: 'Solicitud de Vacaciones',
            ferias_section_employee: 'Datos del Colaborador',
            ferias_section_request: 'Solicitud',
            ferias_section_signature: 'Firma del Colaborador',
            ferias_submit: 'Enviar a RR. HH.',
            vagas_title: 'Formulario de Apertura de Vacante',
            vagas_section_general: 'Datos Generales',
            vagas_section_reason: 'Motivo de la Contratación',
            vagas_section_hiring: 'Contratación',
            vagas_section_profile: 'Perfil de la Vacante',
            vagas_section_requester: 'Datos del Solicitante',
            taxas_title: 'Formulario de Pago de Tasas',
            taxas_section_fee: 'Datos de la Tasa',
            taxas_section_banking: 'Datos Bancarios',
            taxas_section_reason: 'Motivo',
            taxas_submit_another: 'Enviar y Completar Otra',
            solicitacao_taxa_title: 'Solicitud de Mano de Obra',
            solicitacao_taxa_subtitle: 'Solicitud de tasa extra para eventos, cobertura o aumento de demanda.',
            onthejob_title: 'FORMULARIO ON THE JOB',
            onthejob_section_initial: 'Datos Iniciales',
            onthejob_section_compare: 'Comparativo',
            onthejob_submit: 'Enviar Formulario',
            onthejob_label_colaborador: 'Colaborador',
            onthejob_select_colaborador_placeholder: 'Seleccione un colaborador...',
            onthejob_label_empresa: 'Empresa',
            onthejob_placeholder_empresa: 'Unidad/Empresa',
            onthejob_label_data_proposta: 'Fecha de la Propuesta',
            onthejob_label_vigorar_inicio: 'Vigente desde',
            onthejob_label_vigorar_fim: 'Hasta',
            onthejob_table_header_info: 'Información',
            onthejob_table_header_atual: 'Actual',
            onthejob_table_header_proposta: 'Propuesta',
            onthejob_field_cargo: 'Cargo:',
            onthejob_field_horario: 'Horario:',
            onthejob_field_setor: 'Sector:',
            onthejob_field_obs: 'Observación:',
            onthejob_section_details: 'Detalles del Movimiento',
            onthejob_label_nivel: 'Nivel del Movimiento/Promoción:',
            onthejob_opt_junior: 'Junior',
            onthejob_opt_pleno: 'Pleno',
            onthejob_opt_senior: 'Senior',
            onthejob_label_faixa: 'Rango de Encaje salarial:',
            onthejob_label_processo: 'El proceso de ON THE JOB encaja en:',
            onthejob_opt_promocao: 'Promoción',
            onthejob_opt_mudanca: 'Cambio de Función',
            onthejob_opt_enquadramento: 'Encuadramiento',
            onthejob_label_jornada: 'Jornada semanal:',
            onthejob_opt_flexivel: 'Flexible',
            onthejob_opt_44h: '44h',
            onthejob_opt_confianca: 'Puesto de Confianza',
            onthejob_opt_horista: 'Por hora',
            onthejob_label_exame: '¿Es necesario realizar examen por cambio de función?',
            onthejob_opt_sim: 'Sí',
            onthejob_opt_nao: 'No',
            onthejob_opt_na: 'N/A',
            onthejob_section_salary: 'Cambio Salarial',
            onthejob_salary_header_info: 'Información / Fecha',
            onthejob_salary_header_de: 'De: Actual (R$)',
            onthejob_salary_header_para: 'Para: Propuesta (R$)',
            onthejob_salary_label: 'Salario:',
            onthejob_section_benefits: 'Beneficios',
            onthejob_beneficio: 'Beneficio',
            onthejob_imediato: 'Inmediato',
            onthejob_apos90: 'Después de 90 días',
            onthejob_apos180: 'Después de 180 días',
            recrutamento_title: 'Reclutamiento Interno',
            recrutamento_section_job: 'Datos de la Vacante',
            recrutamento_section_employee: 'Datos del Colaborador',
            recrutamento_section_education: 'Formación Académica',
            recrutamento_section_courses: 'Cursos Complementarios',
            recrutamento_section_expectations: 'Expectativas',
            recrutamento_section_availability: 'Disponibilidad',
            recrutamento_submit: 'Enviar Candidatura',
            avaliacao_operacional_title: 'Evaluación de Desempeño - Operacional',
            avaliacao_operacional_subtitle: 'Formulario de evaluación para el equipo operacional',
            avaliacao_adm_title: 'Evaluación de Desempeño - Administrativo',
            avaliacao_adm_subtitle: 'Formulario de evaluación para el equipo administrativo',
            avaliacao_lideranca_title: 'Evaluación de Desempeño - Liderazgo',
            avaliacao_lideranca_subtitle: 'Formulario de evaluación de gestores y líderes',
            avaliacao_submit: 'Enviar Evaluación',
            avaliacao_experiencia_title: 'EVALUACIÓN DE EXPERIENCIA',
            avaliacao_experiencia_subtitle: 'Seguimiento de 45 y 90 días',
            avaliacao_experiencia_submit: '💾 Guardar Evaluación (45 Días)',
            login_title: 'Acceso Restringido',
            login_username: 'Usuario',
            login_password: 'Contraseña',
            login_submit: 'Entrar',
            login_go_portal: 'Ir al Portal',
            epi_title: 'Solicitud de EPI',
            epi_subtitle: 'Informe CPF o matrícula y seleccione los EPIs deseados',
            epi_section_id: 'Identificación',
            epi_placeholder_doc: 'CPF o matrícula',
            epi_section_employee: 'Colaborador',
            epi_not_identified: 'No identificado',
            epi_section_search: 'Buscar EPI',
            epi_placeholder_search: 'Escriba el nombre del EPI...',
            epi_no_password: 'Esta pantalla no requiere contraseña.',
            epi_available: 'EPIs disponibles',
            epi_new_employee: 'Nuevo colaborador',
            trabalhe_title: 'Banco de Talentos',
            trabalhe_mark: 'RECLUTAMIENTO',
            formTitle: 'Formulario de Reclutamiento',
            formNote: 'Complete los datos a continuación para postularse.',
            personalData: 'Datos Personales',
            candidateName: 'Nombre del Candidato:',
            naturalidade: 'Lugar de Nacimiento:',
            birthDate: 'Fecha de Nacimiento:',
            age: 'Edad:',
            civilStatus: 'Estado Civil:',
            address: 'Dirección:',
            neighborhood: 'Barrio:',
            city: 'Ciudad:',
            phone: 'Teléfono:',
            recado: 'Recado:',
            rg: 'RG / RNE:',
            cpf: 'CPF:',
            race: 'Raza/Etnia:',
            email: 'Correo electrónico:',
            children: '¿Hijos menores de edad?',
            childrenQuantity: 'Si es así, ¿cuántos?',
            education: 'Escolaridad:',
            vtCardNumber: 'Nº de tarjeta VT:',
            workInformation: 'Información Laboral',
            worked: '¿Ya trabajó en Madalosso?',
            periodAndFunction: '¿Qué período y función?',
            shirt: 'Camiseta:',
            pants: 'Pantalón:',
            shoe: 'Zapato (nº):',
            professionalExperience: 'Experiencia Profesional',
            lastCompany: 'Última Empresa:',
            penultimateCompany: 'Penúltima Empresa:',
            cargo: 'Cargo:',
            lastSalary: 'Último Salario:',
            admission: 'Ingreso:',
            departure: 'Salida:',
            reasonForDeparture: 'Motivo de salida:',
            otherInformation: 'Otras Informaciones',
            availability: 'Disponibilidad de horario:',
            salaryPretension: 'Pretensión salarial:',
            attachResume: 'Adjunte su Currículum',
            consentTerm: 'Término de Consentimiento',
            consentText: 'En cumplimiento de la Ley 13.709/18 (LGPD), autorizo a la empresa IRMÃOS MADALOSSO LTDA a tratar mis datos personales con fines de reclutamiento y selección.',
            authorizeTreatment: 'Autorizo el tratamiento de mis datos',
            send: 'Enviar Postulación',
            responder_form_loading: 'Cargando formulario...',
            responder_form_submit: 'Enviar Respuestas',
            responder_form_success_title: '¡Formulario Enviado!',
            responder_form_success_desc: 'Tus respuestas se registraron correctamente.',
            responder_form_fill_again: 'Completar de Nuevo',
            responder_form_type_avaliacao: 'Evaluación de Desempeño',
            responder_form_type_pesquisa: 'Encuesta / Formulario',
            responder_form_answer_placeholder: 'Tu respuesta...',
            responder_form_select_placeholder: 'Seleccione una opción...',
            responder_form_yes: 'Sí',
            responder_form_no: 'No',
            responder_form_file_formats: 'Formatos aceptados: PDF, DOC, DOCX, Imagen (Máx 5MB)',
            responder_form_required_field: 'Este campo es obligatorio',
            responder_form_sending: 'Enviando...',
            responder_form_alert_title: 'Atención',
            responder_form_alert_required: 'Por favor, revise los campos obligatorios.',
            responder_form_error_title: 'Error',
            responder_form_error_connection: 'Error de conexión',
            responder_form_error_file_too_big: 'El archivo supera 5MB.',
            responder_form_error_send: 'Error al enviar respuestas',
            responder_form_error_no_id: 'No se proporcionó el ID del formulario.',
            responder_form_no_questions: 'Este formulario no tiene preguntas.',
            rh_dash_back_portal: 'Volver al Portal',
            rh_dash_select: 'Seleccione...',
            rh_dash_save: 'Guardar',
            rh_dash_th_nome: 'Nombre',
            rh_dash_usuarios_title: 'Gestión de Usuarios',
            rh_dash_usuarios_subtitle: 'Gestiona el acceso al Portal de RR. HH.',
            rh_dash_usuarios_import_ldap: 'Importar LDAP',
            rh_dash_usuarios_new: 'Nuevo Usuario',
            rh_dash_usuarios_form_new: 'Nuevo Usuario',
            rh_dash_usuarios_label_username: 'Usuario (Login)',
            rh_dash_usuarios_placeholder_username: 'ej: juan.perez',
            rh_dash_usuarios_label_name: 'Nombre Completo',
            rh_dash_usuarios_placeholder_name: 'ej: Juan Pérez',
            rh_dash_usuarios_label_password: 'Contraseña',
            rh_dash_usuarios_password_hint_new: 'Obligatorio para usuarios nuevos',
            rh_dash_usuarios_label_role: 'Perfil de Acceso',
            rh_dash_usuarios_th_username: 'Usuario',
            rh_dash_usuarios_th_role: 'Perfil',
            rh_dash_usuarios_th_created: 'Creado en',
            rh_exit_form_title: 'Entrevista de Salida',
            rh_exit_form_subtitle: 'Por favor, complete la información a continuación.',
            rh_exit_form_section_type: 'TIPO DE SALIDA',
            rh_exit_form_section_reason: 'MOTIVO DE LA SALIDA',
            rh_exit_form_section_final: 'PREGUNTAS FINALES',
            rh_exit_form_submit: 'Enviar Entrevista',
            rh_dash_filter_all: 'Todos',
            rh_dash_loading: 'Cargando...',
            rh_dash_th_data: 'Fecha',
            rh_dash_th_cpf: 'CPF',
            rh_dash_th_cargo: 'Cargo',
            rh_dash_th_admissao: 'Admisión',
            rh_dash_search: 'Buscar',
            rh_dash_type: 'Tipo',
            rh_dash_status: 'Estado',
            rh_dash_status_active: 'Activo',
            rh_dash_status_inactive: 'Inactivo',
            rh_dash_clear: 'Limpiar',
            rh_dash_preview: 'Visualizar',
            rh_dash_settings: 'Configuración',
            rh_dash_add: 'Agregar',
            rh_dash_preview_title: 'Vista previa',
            rh_dash_close: 'Cerrar',
            rh_dash_export_excel: 'Exportar Excel',
            rh_dash_instructions: 'Instrucciones',
            rh_dash_candidatos_title: 'Gestión de Candidatos',
            rh_dash_candidatos_subtitle: 'Sigue el flujo de reclutamiento y selección',
            rh_dash_candidatos_search_label: 'Buscar Candidato',
            rh_dash_candidatos_search_placeholder: 'Nombre, email o cargo...',
            rh_dash_candidatos_filter_label: 'Filtrar por Vacante/Cargo',
            rh_dash_candidatos_filter_all: 'Todos los Cargos',
            rh_dash_candidatos_loading: 'Cargando candidatos...',
            rh_dash_recrutamento_title: 'Reclutamiento Interno',
            rh_dash_recrutamento_subtitle: 'Sigue las candidaturas internas',
            rh_dash_recrutamento_search_label: 'Buscar Candidato',
            rh_dash_recrutamento_search_placeholder: 'Nombre o Cargo Deseado...',
            rh_dash_recrutamento_loading: 'Cargando candidaturas...',
            rh_dash_recrutamento_th_data: 'Fecha',
            rh_dash_recrutamento_th_cargo_atual: 'Cargo Actual',
            rh_dash_recrutamento_th_cargo_pretendido: 'Cargo Deseado',
            rh_dash_req_taxas_title: 'Solicitudes de Tasa',
            rh_dash_req_taxas_subtitle: 'Autorización previa para contratación de mano de obra extra',
            rh_dash_req_taxas_recent_title: 'Solicitudes Recientes',
            rh_dash_req_taxas_th_data: 'Fecha Nec.',
            rh_dash_req_taxas_th_solicitante: 'Solicitante',
            rh_dash_req_taxas_th_depto: 'Depto',
            rh_dash_req_taxas_th_motivo: 'Motivo',
            rh_dash_req_taxas_th_vagas: 'Vacantes',
            rh_dash_req_taxas_th_acoes: 'Acciones',
            rh_dash_vagas_title: 'Gestión de Vacantes',
            rh_dash_vagas_subtitle: 'Controla las vacantes abiertas y candidatos inscritos',
            rh_dash_vagas_stat_open: 'Vacantes Abiertas',
            rh_dash_vagas_stat_candidates: 'Candidatos Total',
            rh_dash_vagas_stat_closed: 'Cerradas',
            rh_dash_vagas_stat_cancelled: 'Canceladas',
            rh_dash_vagas_tab_open: 'Vacantes Abiertas',
            rh_dash_vagas_tab_closed: 'Cerradas / Canceladas',
            rh_dash_vagas_active_title: 'Vacantes Activas',
            rh_dash_vagas_new: 'Nueva Vacante',
            rh_dash_vagas_th_titulo: 'Título de la Vacante',
            rh_dash_vagas_th_candidatos: 'Candidatos',
            rh_dash_vagas_empty_active: 'No hay vacantes activas en este momento.',
            rh_dash_vagas_history_title: 'Historial de Vacantes',
            rh_dash_vagas_empty_history: 'No hay vacantes cerradas.',
            rh_dash_vagas_modal_suggestions: 'Candidatos Sugeridos',
            rh_dash_desligamento_title: 'Entrevistas de Salida',
            rh_dash_desligamento_subtitle: 'Gestiona y visualiza las entrevistas de salida',
            rh_dash_desligamento_open_form: 'Abrir Formulario para el Colaborador',
            rh_dash_desligamento_history: 'Historial de Entrevistas',
            rh_dash_desligamento_th_tipo: 'Tipo',
            rh_dash_desligamento_th_motivo: 'Motivo',
            rh_dash_epis_title: 'Gestión de EPIs',
            rh_dash_epis_subtitle: 'Registra los equipos y valores para control de portería',
            rh_dash_epis_stat_total_stock: 'Total en Stock',
            rh_dash_epis_stat_low_stock: 'Stock Bajo',
            rh_dash_epis_stat_total_value: 'Valor Total',
            rh_dash_epis_label_nome: 'Nombre del EPI',
            rh_dash_epis_placeholder_nome: 'Ej: Casco de Seguridad',
            rh_dash_epis_label_valor: 'Valor (R$)',
            rh_dash_epis_placeholder_valor: '0.00',
            rh_dash_epis_label_estoque: 'Stock Inicial',
            rh_dash_epis_placeholder_estoque: '0',
            rh_dash_epis_label_ca: 'Validez del CA',
            rh_dash_epis_add: 'Agregar EPI',
            rh_dash_epis_import_excel: 'Importar Excel',
            rh_dash_epis_terms_title: 'Términos de Descuento',
            rh_dash_epis_terms_subtitle: 'Gestión de descuentos generados por la portería',
            rh_dash_epis_terms_loading: 'Cargando términos...',
            rh_dash_epis_mov_title: 'Historial de Movimientos',
            rh_dash_epis_mov_subtitle: 'Registro de entregas y devoluciones en la portería',
            rh_dash_epis_mov_loading: 'Cargando movimientos...',
            rh_dash_epis_modal_evidence: 'Evidencia',
            rh_dash_funcionarios_title: 'Gestión de Empleados',
            rh_dash_funcionarios_subtitle: 'Importa la base de datos para validación biométrica y registro',
            rh_dash_funcionarios_sync_questor: 'Sincronizar Questor',
            rh_dash_funcionarios_download_template: 'Descargar Plantilla Excel',
            rh_dash_funcionarios_upload_hint: 'Haz clic para importar Excel/CSV',
            rh_dash_funcionarios_inst_cols: 'El archivo debe contener las columnas: <strong>Nombre, CPF, Cargo, Sector, Fecha de Admisión</strong>.',
            rh_dash_funcionarios_inst_cpf: 'El CPF debe contener solo números o puntuación estándar.',
            rh_dash_funcionarios_inst_replace: 'Esta importación <strong>sustituye/actualiza</strong> la base existente.',
            rh_dash_onthejob_title: 'On The Job',
            rh_dash_onthejob_subtitle: 'Sigue las propuestas de movimiento',
            rh_dash_onthejob_new: 'Nuevo On The Job',
            rh_dash_onthejob_search_label: 'Buscar Colaborador',
            rh_dash_onthejob_search_placeholder: 'Nombre o Empresa...',
            rh_dash_onthejob_loading: 'Cargando propuestas...',
            rh_dash_onthejob_th_empresa: 'Empresa',
            rh_dash_onthejob_th_cargo_proposto: 'Cargo Propuesto',
            rh_dash_onthejob_th_vigorar: 'Vigente en',
            rh_dash_avaliacoes_title: 'Evaluaciones de Desempeño',
            rh_dash_avaliacoes_subtitle: 'Sigue las evaluaciones de Liderazgo, Administrativo y Operacional',
            rh_dash_avaliacoes_search_label: 'Buscar Empleado',
            rh_dash_avaliacoes_search_placeholder: 'Nombre...',
            rh_dash_avaliacoes_type_label: 'Tipo de Evaluación',
            rh_dash_avaliacoes_type_leadership: 'Liderazgo',
            rh_dash_avaliacoes_type_admin: 'Administrativo',
            rh_dash_avaliacoes_type_operational: 'Operacional',
            rh_dash_avaliacoes_kpi_total: 'Total de Evaluaciones',
            rh_dash_avaliacoes_kpi_avg: 'Promedio General',
            rh_dash_avaliacoes_kpi_approved: 'Aprobados (>80%)',
            rh_dash_avaliacoes_kpi_attention: 'En Atención (<50%)',
            rh_dash_avaliacoes_chart_dist: 'Distribución por Tipo',
            rh_dash_avaliacoes_chart_avg: 'Promedio por Tipo',
            rh_dash_avaliacoes_th_funcionario: 'Empleado',
            rh_dash_avaliacoes_th_tipo: 'Tipo',
            rh_dash_avaliacoes_th_avaliador: 'Evaluador',
            rh_dash_avaliacoes_th_pontuacao: 'Puntuación',
            rh_dash_avaliacoes_modal_title: 'Detalles de la Evaluación',
            rh_dash_experiencia_title: 'Evaluaciones de Experiencia',
            rh_dash_experiencia_subtitle: 'Seguimiento de 45 y 90 días',
            rh_dash_experiencia_new: 'Nueva Evaluación',
            rh_dash_experiencia_chip_title: 'Vista del Gestor',
            rh_dash_experiencia_chip_desc: 'Muestra solo quienes están en alerta',
            rh_dash_experiencia_filter_stability: 'Estabilidad',
            rh_dash_experiencia_stability_probation: 'En período de prueba',
            rh_dash_experiencia_stability_stable: 'Con estabilidad',
            rh_dash_experiencia_stat_next_45: 'Próximos 45 días',
            rh_dash_experiencia_stat_next_90: 'Próximos 90 días',
            rh_dash_experiencia_stat_overdue_45: 'Atrasado 45 días',
            rh_dash_experiencia_stat_overdue_90: 'Atrasado 90 días',
            rh_dash_experiencia_th_created: 'Fecha de Creación',
            rh_dash_experiencia_th_status_45: 'Estado 45 Días',
            rh_dash_experiencia_th_status_90: 'Estado 90 Días',
            rh_dash_experiencia_th_deadline_45: 'Plazo 45 Días',
            rh_dash_experiencia_th_deadline_90: 'Plazo 90 Días',
            rh_dash_experiencia_th_stability: 'Estabilidad',
            rh_dash_formularios_title: 'Gestión de Formularios',
            rh_dash_formularios_subtitle: 'Crea y edita formularios de evaluación y encuesta',
            rh_dash_formularios_new: 'Nuevo Formulario',
            rh_dash_formularios_search_placeholder: 'Buscar por ID o título',
            rh_dash_formularios_th_title: 'Título',
            rh_dash_formularios_th_questions: 'Preguntas',
            rh_dash_formularios_empty: 'No se encontraron formularios.',
            rh_dash_formularios_empty_cta: 'Crear Primer Formulario',
            rh_dash_formularios_modal_title: 'Editar Formulario',
            rh_dash_formularios_label_title: 'Título del Formulario',
            rh_dash_formularios_placeholder_title: 'Ej: Evaluación de Clima',
            rh_dash_formularios_type_perf: 'Evaluación de Desempeño',
            rh_dash_formularios_type_climate: 'Encuesta de Clima',
            rh_dash_formularios_type_checklist: 'Checklist',
            rh_dash_formularios_active: 'Formulario Activo',
            rh_dash_formularios_save_form: 'Guardar Formulario',
            rh_dash_formularios_questions: 'Preguntas',
            rh_dash_formularios_inline_preview: 'Vista previa del Formulario',
            rh_dash_formularios_add_question_hint: 'Haz clic para agregar una nueva pregunta',
            rh_portaria_requests: 'Solicitudes',
            rh_portaria_panel: 'Panel',
            rh_portaria_stock: 'Gestión de Stock',
            rh_portaria_kiosk_title: 'Punto / EPI',
            rh_portaria_kiosk_subtitle: 'Ingrese el CPF o Matrícula',
            rh_portaria_enter: 'ENTRAR',
            rh_portaria_stock_title: 'Gestión de Stock - Portería',
            rh_portaria_requests_title: 'Solicitudes de EPI',
            rh_portaria_requests_search: 'Buscar por nombre, CPF, matrícula o EPI...',
            rh_portaria_deliver: 'ENTREGAR (Retiro)',
            rh_portaria_search_epi: 'Buscar EPI...',
            rh_portaria_return: 'DEVOLVER (Devolución)',
            rh_portaria_search_possession: 'Buscar en posesión...',
            rh_portaria_pill_pickup: 'Retiro',
            rh_portaria_pill_return: 'Devolución',
            rh_portaria_cancel: 'Cancelar',
            rh_portaria_confirm: 'CONFIRMAR',
            rh_portaria_confirm_title: 'Confirmación Biométrica',
            rh_portaria_confirm_desc: 'Pida al empleado que confirme la operación.',
            rh_portaria_tab_signature: 'Firma Digital',
            rh_portaria_tab_facial: 'Reconocimiento Facial',
            rh_portaria_clear: 'Limpiar',
            rh_portaria_sign_hint: 'Firme en el área de arriba',
            rh_portaria_camera_on: 'Activar Cámara'
        },
        en: {
            solicitacao_taxa_label_evento: 'Event Name',
            solicitacao_taxa_ph_evento: 'e.g., Mother’s Day, Silva Wedding...',
            solicitacao_taxa_label_substituto: 'Name of Employee to be Replaced',
            solicitacao_taxa_ph_substituto: 'Name of the employee absent or on vacation',
            rh_title: 'HR Portal - Madalosso Family',
            rh_ferias_title: 'HR Dashboard - Vacations',
            rh_taxas_title: 'HR Dashboard - Fees',
            rh_portal_title: 'HR Portal',
            rh_portal_subtitle: 'Select the module you want to access',
            rh_nav_brand: 'HR Portal',
            rh_nav_ferias: 'Vacations',
            rh_nav_pgto_taxas: 'Fees Payments',
            rh_nav_req_taxas: 'Fees Requests',
            rh_nav_candidatos: 'Candidates',
            rh_nav_recrutamento: 'Internal Recruitment',
            rh_nav_onthejob: 'On The Job',
            rh_nav_vagas: 'Job Postings',
            rh_nav_epis: 'PPE',
            rh_nav_desligamento: 'Exit',
            rh_nav_avaliacoes: 'Reviews',
            rh_nav_experiencia: 'Probation',
            rh_nav_formularios: 'Forms',
            rh_nav_sair: 'Logout',
            rh_dash_ferias_title: 'Vacation Management',
            rh_dash_ferias_subtitle: 'Manage employees vacation requests',
            rh_dash_last_update_now: 'Updated just now',
            rh_dash_stat_pending: 'Pending (HR)',
            rh_dash_stat_done: 'Completed',
            rh_dash_stat_rejected: 'Rejected',
            rh_dash_history_title: 'Requests History',
            rh_dash_refresh: 'Refresh',
            rh_dash_th_colaborador: 'Employee',
            rh_dash_th_setor: 'Department',
            rh_dash_th_inicio: 'Vacation Start',
            rh_dash_th_status: 'Status',
            rh_dash_th_acao: 'Action',
            rh_dash_empty_title: 'No requests found.',
            rh_dash_empty_desc: 'All clear here! 🎉',
            rh_dash_taxas_title: 'Fees Management',
            rh_dash_taxas_subtitle: 'Track and approve payment requests',
            rh_dash_taxas_stat_pending: 'Pending',
            rh_dash_taxas_stat_approved: 'Approved',
            rh_dash_taxas_recent_title: 'Recent Requests',
            rh_dash_taxas_generate_payment: 'Generate Payment File',
            rh_dash_taxas_th_departamento: 'Department',
            rh_dash_taxas_th_funcao: 'Role',
            rh_dash_taxas_th_total: 'Total',
            rh_dash_taxas_empty_title: 'No fee requests found.',
            rh_dash_taxas_empty_desc: 'New requests will appear here.',
            rh_card_ferias_title: 'Vacation Management',
            rh_card_ferias_desc: 'Approve requests, view calendar, and vacation history.',
            rh_card_taxas_title: 'Fees Payments',
            rh_card_taxas_desc: 'Manage payment requests, approvals, and generate receipts.',
            rh_card_candidatos_title: 'Talent Pool',
            rh_card_candidatos_desc: 'Manage candidates, screen résumés, and recruitment processes.',
            rh_card_recrutamento_title: 'Internal Recruitment',
            rh_card_recrutamento_desc: 'Track internal applications from employees.',
            rh_card_onthejob_title: 'On The Job',
            rh_card_onthejob_desc: 'Manage movement and promotion processes.',
            rh_card_vagas_title: 'Job Postings',
            rh_card_vagas_desc: 'Publish and manage job openings available on the site.',
            rh_card_epis_title: 'PPE Management',
            rh_card_epis_desc: 'Equipment and uniform catalog for gatehouse control.',
            rh_card_portaria_title: 'Gatehouse',
            rh_card_portaria_desc: 'Track PPE delivery and returns per employee.',
            rh_card_funcionarios_title: 'Employees',
            rh_card_funcionarios_desc: 'Register and import employee base (CPF/ID).',
            rh_card_desligamento_title: 'Exit Interviews',
            rh_card_desligamento_desc: 'Exit interview forms and reports.',
            rh_card_avaliacoes_title: 'Performance Reviews',
            rh_card_avaliacoes_desc: 'Performance dashboard: Leadership, Admin, and Operations.',
            rh_card_experiencia_title: 'Probation',
            rh_card_experiencia_desc: 'Track probation period (45 and 90 days).',
            rh_card_formularios_title: 'Forms',
            rh_card_formularios_desc: 'Create and edit survey and evaluation forms.',
            rh_card_usuarios_title: 'User Management',
            rh_card_usuarios_desc: 'Manage portal access and roles.',
            rh_footer: '© 2025 Madalosso Family. HR restricted access.',
            idx_brand: 'Internal Portal',
            idx_restricted: 'Restricted Area',
            idx_welcome: 'Welcome to the Portal',
            idx_welcome_desc: 'Access the request forms below or use the restricted access button for admin areas.',
            idx_card_ferias_title: 'Vacation Request',
            idx_card_ferias_desc: 'Form for requesting and scheduling employee vacations.',
            idx_card_vagas_title: 'Open a Position',
            idx_card_vagas_desc: 'Form to request opening of new job positions.',
            idx_card_taxas_title: 'Fees Payment',
            idx_card_taxas_desc: 'Form to request payment of fees and transport.',
            idx_card_solicitacao_taxa_title: 'Extra Labor Request',
            idx_card_solicitacao_taxa_desc: 'Request extra labor (fee) for events or coverage.',
            idx_card_trabalhe_title: 'Work With Us',
            idx_card_trabalhe_desc: 'Form to send résumé and join the talent pool.',
            idx_card_recrutamento_title: 'Internal Recruitment',
            idx_card_recrutamento_desc: 'Form for internal applications to available positions.',
            idx_card_onthejob_title: 'On The Job',
            idx_card_onthejob_desc: 'Form for movement and promotion process (On The Job).',
            idx_title: 'Forms Portal - Madalosso Family',
            public_back_menu: 'Back to Menu',
            public_footer_rights: '© 2025 Madalosso Family. All rights reserved.',
            public_footer_rh_access: 'HR Access',
            public_submit: 'Submit Request',
            public_clear: 'Clear',
            public_continue: 'Continue',
            public_reset: 'Reset',
            public_reload: 'Reload',
            public_loading: 'Loading...',
            public_error: 'Error',
            public_try_again: 'Try Again',
            public_section_signature: 'Responsible Signature',
            public_signature_handwritten: 'Handwritten signature',
            ferias_title: 'Vacation Request',
            ferias_section_employee: 'Employee Data',
            ferias_section_request: 'Request',
            ferias_section_signature: 'Employee Signature',
            ferias_submit: 'Send to HR',
            vagas_title: 'Open Position Form',
            vagas_section_general: 'General Data',
            vagas_section_reason: 'Hiring Reason',
            vagas_section_hiring: 'Hiring',
            vagas_section_profile: 'Position Profile',
            vagas_section_requester: 'Requester Data',
            taxas_title: 'Fees Payment Form',
            taxas_section_fee: 'Fee Data',
            taxas_section_banking: 'Banking Details',
            taxas_section_reason: 'Reason',
            taxas_submit_another: 'Submit and Fill Another',
            solicitacao_taxa_title: 'Extra Labor Request',
            solicitacao_taxa_subtitle: 'Extra fee request for events, coverage, or increased demand.',
            onthejob_title: 'ON THE JOB FORM',
            onthejob_section_initial: 'Initial Data',
            onthejob_section_compare: 'Comparison',
            onthejob_submit: 'Submit Form',
            onthejob_label_colaborador: 'Employee',
            onthejob_select_colaborador_placeholder: 'Select an employee...',
            onthejob_label_empresa: 'Company',
            onthejob_placeholder_empresa: 'Unit/Company',
            onthejob_label_data_proposta: 'Proposal Date',
            onthejob_label_vigorar_inicio: 'Effective from',
            onthejob_label_vigorar_fim: 'Until',
            onthejob_table_header_info: 'Information',
            onthejob_table_header_atual: 'Current',
            onthejob_table_header_proposta: 'Proposed',
            onthejob_field_cargo: 'Role:',
            onthejob_field_horario: 'Schedule:',
            onthejob_field_setor: 'Department:',
            onthejob_field_obs: 'Note:',
            onthejob_section_details: 'Movement Details',
            onthejob_label_nivel: 'Movement/Promotion Level:',
            onthejob_opt_junior: 'Junior',
            onthejob_opt_pleno: 'Mid',
            onthejob_opt_senior: 'Senior',
            onthejob_label_faixa: 'Salary Band:',
            onthejob_label_processo: 'ON THE JOB process fits as:',
            onthejob_opt_promocao: 'Promotion',
            onthejob_opt_mudanca: 'Role Change',
            onthejob_opt_enquadramento: 'Enframing',
            onthejob_label_jornada: 'Weekly workload:',
            onthejob_opt_flexivel: 'Flexible',
            onthejob_opt_44h: '44h',
            onthejob_opt_confianca: 'Trusted Position',
            onthejob_opt_horista: 'Hourly',
            onthejob_label_exame: 'Is a function-change exam required?',
            onthejob_opt_sim: 'Yes',
            onthejob_opt_nao: 'No',
            onthejob_opt_na: 'N/A',
            onthejob_section_salary: 'Salary Change',
            onthejob_salary_header_info: 'Information / Date',
            onthejob_salary_header_de: 'From: Current (R$)',
            onthejob_salary_header_para: 'To: Proposed (R$)',
            onthejob_salary_label: 'Salary:',
            onthejob_section_benefits: 'Benefits',
            onthejob_beneficio: 'Benefit',
            onthejob_imediato: 'Immediate',
            onthejob_apos90: 'After 90 days',
            onthejob_apos180: 'After 180 days',
            recrutamento_title: 'Internal Recruitment',
            recrutamento_section_job: 'Job Data',
            recrutamento_section_employee: 'Employee Data',
            recrutamento_section_education: 'Education',
            recrutamento_section_courses: 'Additional Courses',
            recrutamento_section_expectations: 'Expectations',
            recrutamento_section_availability: 'Availability',
            recrutamento_submit: 'Submit Application',
            avaliacao_operacional_title: 'Performance Review - Operational',
            avaliacao_operacional_subtitle: 'Evaluation form for the operational team',
            avaliacao_adm_title: 'Performance Review - Administrative',
            avaliacao_adm_subtitle: 'Evaluation form for the administrative team',
            avaliacao_lideranca_title: 'Performance Review - Leadership',
            avaliacao_lideranca_subtitle: 'Evaluation form for managers and leaders',
            avaliacao_submit: 'Submit Review',
            avaliacao_experiencia_title: 'PROBATION REVIEW',
            avaliacao_experiencia_subtitle: '45 and 90 day follow-up',
            avaliacao_experiencia_submit: '💾 Save Review (45 Days)',
            login_title: 'Restricted Access',
            login_username: 'Username',
            login_password: 'Password',
            login_submit: 'Sign In',
            login_go_portal: 'Go to Portal',
            epi_title: 'PPE Request',
            epi_subtitle: 'Enter CPF or employee ID and select the desired PPE',
            epi_section_id: 'Identification',
            epi_placeholder_doc: 'CPF or employee ID',
            epi_section_employee: 'Employee',
            epi_not_identified: 'Not identified',
            epi_section_search: 'Search PPE',
            epi_placeholder_search: 'Type the PPE name...',
            epi_no_password: 'This screen does not require a password.',
            epi_available: 'Available PPE',
            epi_new_employee: 'New employee',
            trabalhe_title: 'Talent Pool',
            trabalhe_mark: 'RECRUITMENT',
            formTitle: 'Recruitment Form',
            formNote: 'Fill out the details below to apply.',
            personalData: 'Personal Data',
            candidateName: 'Candidate Name:',
            naturalidade: 'Place of Birth:',
            birthDate: 'Date of Birth:',
            age: 'Age:',
            civilStatus: 'Marital Status:',
            address: 'Address:',
            neighborhood: 'Neighborhood:',
            city: 'City:',
            phone: 'Phone:',
            recado: 'Alternate phone:',
            rg: 'RG / RNE:',
            cpf: 'CPF:',
            race: 'Race/Ethnicity:',
            email: 'Email:',
            children: 'Children under 18?',
            childrenQuantity: 'If yes, how many?',
            education: 'Education:',
            vtCardNumber: 'Transit card number:',
            workInformation: 'Work Information',
            worked: 'Have you worked at Madalosso before?',
            periodAndFunction: 'Which period and role?',
            shirt: 'T-shirt:',
            pants: 'Pants:',
            shoe: 'Shoe (size):',
            professionalExperience: 'Professional Experience',
            lastCompany: 'Last Company:',
            penultimateCompany: 'Second-to-last Company:',
            cargo: 'Role:',
            lastSalary: 'Last Salary:',
            admission: 'Start date:',
            departure: 'End date:',
            reasonForDeparture: 'Reason for leaving:',
            otherInformation: 'Other Information',
            availability: 'Schedule availability:',
            salaryPretension: 'Salary expectation:',
            attachResume: 'Attach your Resume',
            consentTerm: 'Consent Term',
            consentText: 'In compliance with Law 13.709/18 (LGPD), I authorize IRMÃOS MADALOSSO LTDA to process my personal data for recruitment and selection purposes.',
            authorizeTreatment: 'I authorize the processing of my data',
            send: 'Submit Application',
            responder_form_loading: 'Loading form...',
            responder_form_submit: 'Submit Answers',
            responder_form_success_title: 'Form Submitted!',
            responder_form_success_desc: 'Your answers were saved successfully.',
            responder_form_fill_again: 'Fill Again',
            responder_form_type_avaliacao: 'Performance Review',
            responder_form_type_pesquisa: 'Survey / Form',
            responder_form_answer_placeholder: 'Your answer...',
            responder_form_select_placeholder: 'Select an option...',
            responder_form_yes: 'Yes',
            responder_form_no: 'No',
            responder_form_file_formats: 'Accepted formats: PDF, DOC, DOCX, Image (Max 5MB)',
            responder_form_required_field: 'This field is required',
            responder_form_sending: 'Sending...',
            responder_form_alert_title: 'Attention',
            responder_form_alert_required: 'Please check the required fields.',
            responder_form_error_title: 'Error',
            responder_form_error_connection: 'Connection error',
            responder_form_error_file_too_big: 'The file exceeds 5MB.',
            responder_form_error_send: 'Error sending answers',
            responder_form_error_no_id: 'Form ID was not provided.',
            responder_form_no_questions: 'This form has no questions.',
            rh_dash_back_portal: 'Back to Portal',
            rh_dash_select: 'Select...',
            rh_dash_save: 'Save',
            rh_dash_th_nome: 'Name',
            rh_dash_usuarios_title: 'User Management',
            rh_dash_usuarios_subtitle: 'Manage access to the HR Portal',
            rh_dash_usuarios_import_ldap: 'Import LDAP',
            rh_dash_usuarios_new: 'New User',
            rh_dash_usuarios_form_new: 'New User',
            rh_dash_usuarios_label_username: 'Username (Login)',
            rh_dash_usuarios_placeholder_username: 'e.g. john.smith',
            rh_dash_usuarios_label_name: 'Full Name',
            rh_dash_usuarios_placeholder_name: 'e.g. John Smith',
            rh_dash_usuarios_label_password: 'Password',
            rh_dash_usuarios_password_hint_new: 'Required for new users',
            rh_dash_usuarios_label_role: 'Access Role',
            rh_dash_usuarios_th_username: 'Username',
            rh_dash_usuarios_th_role: 'Role',
            rh_dash_usuarios_th_created: 'Created at',
            rh_exit_form_title: 'Exit Interview',
            rh_exit_form_subtitle: 'Please fill in the information below.',
            rh_exit_form_section_type: 'EXIT TYPE',
            rh_exit_form_section_reason: 'EXIT REASON',
            rh_exit_form_section_final: 'FINAL QUESTIONS',
            rh_exit_form_submit: 'Submit Interview',
            rh_dash_filter_all: 'All',
            rh_dash_loading: 'Loading...',
            rh_dash_th_data: 'Date',
            rh_dash_th_cpf: 'CPF',
            rh_dash_th_cargo: 'Role',
            rh_dash_th_admissao: 'Hire Date',
            rh_dash_search: 'Search',
            rh_dash_type: 'Type',
            rh_dash_status: 'Status',
            rh_dash_status_active: 'Active',
            rh_dash_status_inactive: 'Inactive',
            rh_dash_clear: 'Clear',
            rh_dash_preview: 'Preview',
            rh_dash_settings: 'Settings',
            rh_dash_add: 'Add',
            rh_dash_preview_title: 'Preview',
            rh_dash_close: 'Close',
            rh_dash_export_excel: 'Export Excel',
            rh_dash_instructions: 'Instructions',
            rh_dash_candidatos_title: 'Candidate Management',
            rh_dash_candidatos_subtitle: 'Track the recruitment and selection flow',
            rh_dash_candidatos_search_label: 'Search Candidate',
            rh_dash_candidatos_search_placeholder: 'Name, email or role...',
            rh_dash_candidatos_filter_label: 'Filter by Job/Role',
            rh_dash_candidatos_filter_all: 'All Roles',
            rh_dash_candidatos_loading: 'Loading candidates...',
            rh_dash_recrutamento_title: 'Internal Recruitment',
            rh_dash_recrutamento_subtitle: 'Track internal applications',
            rh_dash_recrutamento_search_label: 'Search Candidate',
            rh_dash_recrutamento_search_placeholder: 'Name or Desired Role...',
            rh_dash_recrutamento_loading: 'Loading applications...',
            rh_dash_recrutamento_th_data: 'Date',
            rh_dash_recrutamento_th_cargo_atual: 'Current Role',
            rh_dash_recrutamento_th_cargo_pretendido: 'Desired Role',
            rh_dash_req_taxas_title: 'Fee Requests',
            rh_dash_req_taxas_subtitle: 'Prior approval for hiring extra labor',
            rh_dash_req_taxas_recent_title: 'Recent Requests',
            rh_dash_req_taxas_th_data: 'Needed Date',
            rh_dash_req_taxas_th_solicitante: 'Requester',
            rh_dash_req_taxas_th_depto: 'Dept.',
            rh_dash_req_taxas_th_motivo: 'Reason',
            rh_dash_req_taxas_th_vagas: 'Openings',
            rh_dash_req_taxas_th_acoes: 'Actions',
            rh_dash_vagas_title: 'Job Postings',
            rh_dash_vagas_subtitle: 'Manage open positions and registered candidates',
            rh_dash_vagas_stat_open: 'Open Positions',
            rh_dash_vagas_stat_candidates: 'Total Candidates',
            rh_dash_vagas_stat_closed: 'Closed',
            rh_dash_vagas_stat_cancelled: 'Cancelled',
            rh_dash_vagas_tab_open: 'Open Positions',
            rh_dash_vagas_tab_closed: 'Closed / Cancelled',
            rh_dash_vagas_active_title: 'Active Openings',
            rh_dash_vagas_new: 'New Opening',
            rh_dash_vagas_th_titulo: 'Job Title',
            rh_dash_vagas_th_candidatos: 'Candidates',
            rh_dash_vagas_empty_active: 'No active openings at the moment.',
            rh_dash_vagas_history_title: 'Openings History',
            rh_dash_vagas_empty_history: 'No closed openings.',
            rh_dash_vagas_modal_suggestions: 'Suggested Candidates',
            rh_dash_desligamento_title: 'Exit Interviews',
            rh_dash_desligamento_subtitle: 'Manage and view exit interviews',
            rh_dash_desligamento_open_form: 'Open Form for Employee',
            rh_dash_desligamento_history: 'Interviews History',
            rh_dash_desligamento_th_tipo: 'Type',
            rh_dash_desligamento_th_motivo: 'Reason',
            rh_dash_epis_title: 'PPE Management',
            rh_dash_epis_subtitle: 'Register equipment and values for gatehouse control',
            rh_dash_epis_stat_total_stock: 'Total Stock',
            rh_dash_epis_stat_low_stock: 'Low Stock',
            rh_dash_epis_stat_total_value: 'Total Value',
            rh_dash_epis_label_nome: 'PPE Name',
            rh_dash_epis_placeholder_nome: 'e.g. Safety Helmet',
            rh_dash_epis_label_valor: 'Value (R$)',
            rh_dash_epis_placeholder_valor: '0.00',
            rh_dash_epis_label_estoque: 'Initial Stock',
            rh_dash_epis_placeholder_estoque: '0',
            rh_dash_epis_label_ca: 'CA Validity',
            rh_dash_epis_add: 'Add PPE',
            rh_dash_epis_import_excel: 'Import Excel',
            rh_dash_epis_terms_title: 'Discount Terms',
            rh_dash_epis_terms_subtitle: 'Manage discounts generated by the gatehouse',
            rh_dash_epis_terms_loading: 'Loading terms...',
            rh_dash_epis_mov_title: 'Movement History',
            rh_dash_epis_mov_subtitle: 'Log of pickups and returns at the gatehouse',
            rh_dash_epis_mov_loading: 'Loading movements...',
            rh_dash_epis_modal_evidence: 'Evidence',
            rh_dash_funcionarios_title: 'Employee Management',
            rh_dash_funcionarios_subtitle: 'Import the database for biometric validation and registration',
            rh_dash_funcionarios_sync_questor: 'Sync Questor',
            rh_dash_funcionarios_download_template: 'Download Excel Template',
            rh_dash_funcionarios_upload_hint: 'Click to import Excel/CSV',
            rh_dash_funcionarios_inst_cols: 'The file must contain: <strong>Name, CPF, Role, Department, Hire Date</strong>.',
            rh_dash_funcionarios_inst_cpf: 'CPF must contain only numbers or standard punctuation.',
            rh_dash_funcionarios_inst_replace: 'This import <strong>replaces/updates</strong> the existing base.',
            rh_dash_onthejob_title: 'On The Job',
            rh_dash_onthejob_subtitle: 'Track movement proposals',
            rh_dash_onthejob_new: 'New On The Job',
            rh_dash_onthejob_search_label: 'Search Employee',
            rh_dash_onthejob_search_placeholder: 'Name or Company...',
            rh_dash_onthejob_loading: 'Loading proposals...',
            rh_dash_onthejob_th_empresa: 'Company',
            rh_dash_onthejob_th_cargo_proposto: 'Proposed Role',
            rh_dash_onthejob_th_vigorar: 'Effective on',
            rh_dash_avaliacoes_title: 'Performance Reviews',
            rh_dash_avaliacoes_subtitle: 'Track Leadership, Admin and Operational reviews',
            rh_dash_avaliacoes_search_label: 'Search Employee',
            rh_dash_avaliacoes_search_placeholder: 'Name...',
            rh_dash_avaliacoes_type_label: 'Review Type',
            rh_dash_avaliacoes_type_leadership: 'Leadership',
            rh_dash_avaliacoes_type_admin: 'Administrative',
            rh_dash_avaliacoes_type_operational: 'Operational',
            rh_dash_avaliacoes_kpi_total: 'Total Reviews',
            rh_dash_avaliacoes_kpi_avg: 'Overall Average',
            rh_dash_avaliacoes_kpi_approved: 'Approved (>80%)',
            rh_dash_avaliacoes_kpi_attention: 'Needs Attention (<50%)',
            rh_dash_avaliacoes_chart_dist: 'Distribution by Type',
            rh_dash_avaliacoes_chart_avg: 'Average Score by Type',
            rh_dash_avaliacoes_th_funcionario: 'Employee',
            rh_dash_avaliacoes_th_tipo: 'Type',
            rh_dash_avaliacoes_th_avaliador: 'Reviewer',
            rh_dash_avaliacoes_th_pontuacao: 'Score',
            rh_dash_avaliacoes_modal_title: 'Review Details',
            rh_dash_experiencia_title: 'Probation Reviews',
            rh_dash_experiencia_subtitle: '45 and 90 day follow-up',
            rh_dash_experiencia_new: 'New Review',
            rh_dash_experiencia_chip_title: 'Manager View',
            rh_dash_experiencia_chip_desc: 'Shows only those in alert',
            rh_dash_experiencia_filter_stability: 'Stability',
            rh_dash_experiencia_stability_probation: 'On probation',
            rh_dash_experiencia_stability_stable: 'Stable',
            rh_dash_experiencia_stat_next_45: 'Next 45 days',
            rh_dash_experiencia_stat_next_90: 'Next 90 days',
            rh_dash_experiencia_stat_overdue_45: 'Overdue 45 days',
            rh_dash_experiencia_stat_overdue_90: 'Overdue 90 days',
            rh_dash_experiencia_th_created: 'Created On',
            rh_dash_experiencia_th_status_45: '45-Day Status',
            rh_dash_experiencia_th_status_90: '90-Day Status',
            rh_dash_experiencia_th_deadline_45: '45-Day Deadline',
            rh_dash_experiencia_th_deadline_90: '90-Day Deadline',
            rh_dash_experiencia_th_stability: 'Stability',
            rh_dash_formularios_title: 'Forms Management',
            rh_dash_formularios_subtitle: 'Create and edit evaluation and survey forms',
            rh_dash_formularios_new: 'New Form',
            rh_dash_formularios_search_placeholder: 'Search by ID or title',
            rh_dash_formularios_th_title: 'Title',
            rh_dash_formularios_th_questions: 'Questions',
            rh_dash_formularios_empty: 'No forms found.',
            rh_dash_formularios_empty_cta: 'Create First Form',
            rh_dash_formularios_modal_title: 'Edit Form',
            rh_dash_formularios_label_title: 'Form Title',
            rh_dash_formularios_placeholder_title: 'e.g. Climate Survey',
            rh_dash_formularios_type_perf: 'Performance Review',
            rh_dash_formularios_type_climate: 'Climate Survey',
            rh_dash_formularios_type_checklist: 'Checklist',
            rh_dash_formularios_active: 'Active Form',
            rh_dash_formularios_save_form: 'Save Form',
            rh_dash_formularios_questions: 'Questions',
            rh_dash_formularios_inline_preview: 'Form Preview',
            rh_dash_formularios_add_question_hint: 'Click to add a new question',
            rh_portaria_requests: 'Requests',
            rh_portaria_panel: 'Panel',
            rh_portaria_stock: 'Stock Management',
            rh_portaria_kiosk_title: 'Time Clock / PPE',
            rh_portaria_kiosk_subtitle: 'Enter CPF or Employee ID',
            rh_portaria_enter: 'ENTER',
            rh_portaria_stock_title: 'Stock Management - Gatehouse',
            rh_portaria_requests_title: 'PPE Requests',
            rh_portaria_requests_search: 'Search by name, CPF, employee ID or PPE...',
            rh_portaria_deliver: 'DELIVER (Pickup)',
            rh_portaria_search_epi: 'Search PPE...',
            rh_portaria_return: 'RETURN',
            rh_portaria_search_possession: 'Search in possession...',
            rh_portaria_pill_pickup: 'Pickup',
            rh_portaria_pill_return: 'Return',
            rh_portaria_cancel: 'Cancel',
            rh_portaria_confirm: 'CONFIRM',
            rh_portaria_confirm_title: 'Biometric Confirmation',
            rh_portaria_confirm_desc: 'Ask the employee to confirm the operation.',
            rh_portaria_tab_signature: 'Digital Signature',
            rh_portaria_tab_facial: 'Facial Recognition',
            rh_portaria_clear: 'Clear',
            rh_portaria_sign_hint: 'Sign in the area above',
            rh_portaria_camera_on: 'Enable Camera'
        }
    };

    window.__APP_I18N__ = translations;

    const placeholderMap = {
        ph_onjob_unit_company: { pt: 'Unidade/Empresa', es: 'Unidad/Empresa', en: 'Unit/Company' },
        ph_select_employee: { pt: 'Selecione um colaborador...', es: 'Seleccione un colaborador...', en: 'Select an employee...' },
        ph_select_employee_alt: { pt: 'Selecione um funcionário...', es: 'Seleccione un funcionario...', en: 'Select an employee...' },
        ph_type_your_name: { pt: 'Digite seu nome', es: 'Escriba su nombre', en: 'Type your name' },
        ph_type_manager_name: { pt: 'Digite nome do gestor', es: 'Escriba el nombre del gestor', en: 'Type manager name' },
        ph_time_in_role: { pt: 'Ex: 1 ano e 2 meses', es: 'Ej.: 1 año y 2 meses', en: 'e.g., 1 year and 2 months' },
        ph_education: { pt: 'Graduação, Pós-graduação, etc.', es: 'Graduación, Posgrado, etc.', en: 'Undergrad, Postgrad, etc.' },
        ph_courses: { pt: 'Cursos técnicos, workshops, idiomas, etc.', es: 'Cursos técnicos, talleres, idiomas, etc.', en: 'Technical courses, workshops, languages, etc.' },
        ph_full_name: { pt: 'Seu nome completo', es: 'Su nombre completo', en: 'Your full name' },
        ph_required_role: { pt: 'Ex: Garçom, Cozinheiro, Commim...', es: 'Ej.: Camarero, Cocinero, Ayudante...', en: 'e.g., Waiter, Cook, Commis...' },
        ph_type_here: { pt: 'Digite aqui...', es: 'Escriba aquí...', en: 'Type here...' },
        ph_instr_rh: { pt: 'Alguma instrução específica para o RH?', es: '¿Alguna instrucción específica para RR. HH.?', en: 'Any specific instruction for HR?' },
        ph_cpf_mask: { pt: '000.000.000-00', es: '000.000.000-00', en: '000.000.000-00' },
        ph_bank: { pt: 'Ex: Nubank, Itaú', es: 'Ej.: Nubank, Itaú', en: 'e.g., Nubank, Itaú' },
        ph_agency: { pt: '0000', es: '0000', en: '0000' },
        ph_account: { pt: '00000-0', es: '00000-0', en: '00000-0' },
        ph_pix: { pt: 'CPF, E-mail ou Telefone', es: 'CPF, Correo o Teléfono', en: 'CPF, Email or Phone' },
        ph_event_name: { pt: 'Nome do Evento (Ex: Dia das Mães)', es: 'Nombre del Evento (Ej.: Día de la Madre)', en: 'Event Name (e.g., Mother’s Day)' },
        ph_predecessor: { pt: 'Nome do antecessor', es: 'Nombre del predecesor', en: 'Predecessor name' },
        ph_schedule_example: { pt: 'Ex: 6x1, 08:00 às 16:20', es: 'Ej.: 6x1, 08:00 a 16:20', en: 'e.g., 6x1, 08:00 to 16:20' },
        ph_job_desc: { pt: 'Descreva as atividades e responsabilidades...', es: 'Describa las actividades y responsabilidades...', en: 'Describe duties and responsibilities...' },
        ph_zero_money: { pt: '0.00', es: '0.00', en: '0.00' },
        ph_zero_qty: { pt: '0', es: '0', en: '0' },
        ph_email_gestor: { pt: 'gestor@familiamadalosso.com.br', es: 'gestor@familiamadalosso.com.br', en: 'manager@familiamadalosso.com.br' },
        ph_email_user: { pt: 'seu.email@familiamadalosso.com.br', es: 'su.email@familiamadalosso.com.br', en: 'your.email@familiamadalosso.com.br' },
        ph_email_gestor_generic: { pt: 'gestor@empresa.com', es: 'gestor@empresa.com', en: 'manager@company.com' },
        ph_manager_name_full: { pt: 'Nome completo do gestor', es: 'Nombre completo del gestor', en: 'Manager full name' },
        ph_reason_desc: { pt: 'Descreva o motivo...', es: 'Describa el motivo...', en: 'Describe the reason...' }
    };

    // Placeholders adicionais (entrevista desligamento)
    placeholderMap['ph_hr_opinion'] = { pt: 'Sua opinião...', es: 'Su opinión...', en: 'Your opinion...' };
    placeholderMap['ph_additional_notes'] = { pt: 'Observações adicionais...', es: 'Observaciones adicionales...', en: 'Additional remarks...' };

    // Text labels without data-translate (fallback map)
    const textMap = {
        // Mensagens gerais usadas em formulários
        'Preenchimento realizado pelo gestor. A assinatura do colaborador será coletada no RH.': { es: 'Relleno realizado por el gestor. La firma del colaborador se recogerá en RR. HH.', en: 'Filled by the manager. The employee signature will be collected at HR.' },
        'Histórico de Alterações': { es: 'Historial de Cambios', en: 'Change History' },
        'Dados do Colaborador': { es: 'Datos del Colaborador', en: 'Employee Data' },
        'Selecione o Colaborador': { es: 'Seleccione el Colaborador', en: 'Select Employee' },
        'Carregando lista...': { es: 'Cargando lista...', en: 'Loading list...' },
        'Selecione...': { es: 'Seleccione...', en: 'Select...' },
        'Nome do colaborador': { es: 'Nombre del colaborador', en: 'Employee name' },
        'Setor': { es: 'Sector', en: 'Department' },
        'Solicitação': { es: 'Solicitud', en: 'Request' },
        'Início das férias': { es: 'Inicio de las vacaciones', en: 'Vacation start' },
        'Período de Férias': { es: 'Período de Vacaciones', en: 'Vacation Period' },
        'Selecione': { es: 'Seleccione', en: 'Select' },
        'Início do segundo período': { es: 'Inicio del segundo período', en: 'Second period start' },
        'E-mail do gestor': { es: 'Correo del gestor', en: 'Manager email' },
        'Nome do Gestor': { es: 'Nombre del Gestor', en: 'Manager name' },
        'Assinatura manuscrita (Colaborador)': { es: 'Firma manuscrita (Colaborador)', en: 'Handwritten signature (Employee)' },
        'Limpar': { es: 'Limpiar', en: 'Clear' },
        'A assinatura será habilitada após aprovação do RH': { es: 'La firma se habilitará tras la aprobación de RR. HH.', en: 'Signature will be enabled after HR approval' },
        'Validação do RH': { es: 'Validación de RR. HH.', en: 'HR Validation' },
        'Aprovar': { es: 'Aprobar', en: 'Approve' },
        'Reprovar': { es: 'Reprobar', en: 'Reject' },
        'Sugestão de nova data': { es: 'Sugerencia de nueva fecha', en: 'New date suggestion' },
        'Justificativa da Reprovação': { es: 'Justificación del Rechazo', en: 'Rejection justification' },
        'A assinatura do RH será realizada via Autentique.': { es: 'La firma de RR. HH. se realizará vía Autentique.', en: 'HR signature will be requested via Autentique.' },
        // Solicitação de Taxa
        'Dados do Solicitante': { es: 'Datos del Solicitante', en: 'Requester Data' },
        'Departamento': { es: 'Departamento', en: 'Department' },
        'Detalhes da Vaga': { es: 'Detalles del Puesto', en: 'Position Details' },
        'Função Necessária': { es: 'Función Necesaria', en: 'Required Role' },
        'Qual o motivo da solicitação?': { es: '¿Cuál es el motivo de la solicitud?', en: 'What is the request reason?' },
        'Aumento de Demanda': { es: 'Aumento de Demanda', en: 'Increased Demand' },
        'Evento Específico': { es: 'Evento Específico', en: 'Specific Event' },
        'Cobertura (Falta/Férias)': { es: 'Cobertura (Ausencia/Vacaciones)', en: 'Coverage (Absence/Vacation)' },
        'Detalhes do Evento': { es: 'Detalles del Evento', en: 'Event Details' },
        'Nome do Colaborador a ser Substituído': { es: 'Nombre del Colaborador a Sustituir', en: 'Name of Employee to be Replaced' },
        'Data e Horário': { es: 'Fecha y Horario', en: 'Date and Time' },
        'Data Necessária': { es: 'Fecha Necesaria', en: 'Required Date' },
        'Quantidade de Vagas': { es: 'Cantidad de Vacantes', en: 'Number of Positions' },
        'Horário Início': { es: 'Horario Inicio', en: 'Start Time' },
        'Horário Fim': { es: 'Horario Fin', en: 'End Time' },
        'Observações Adicionais': { es: 'Observaciones Adicionales', en: 'Additional Notes' },
        // Vagas
        'Cargo': { es: 'Cargo', en: 'Position' },
        'Número de Vagas': { es: 'Número de Vacantes', en: 'Number of Openings' },
        'Data de Abertura': { es: 'Fecha de Apertura', en: 'Opening Date' },
        'Email do Gestor (para notificações)': { es: 'Correo del Gestor (para notificaciones)', en: 'Manager Email (for notifications)' },
        'Motivo da Contratação': { es: 'Motivo de la Contratación', en: 'Hiring Reason' },
        'Substituição': { es: 'Sustitución', en: 'Replacement' },
        'Aumento de Quadro': { es: 'Aumento de Plantilla', en: 'Headcount Increase' },
        'Substituição a (Nome)': { es: 'Sustitución a (Nombre)', en: 'Replacing (Name)' },
        'Será desligado?': { es: '¿Será desvinculado?', en: 'Will be dismissed?' },
        'Sim': { es: 'Sí', en: 'Yes' },
        'Não': { es: 'No', en: 'No' },
        'Reportará a quem?': { es: '¿Reportará a quién?', en: 'Reports to whom?' },
        'Escala / Horário de Trabalho': { es: 'Escala / Horario de Trabajo', en: 'Shift / Working Hours' },
        'Tipo de Contratação': { es: 'Tipo de Contratación', en: 'Hiring Type' },
        'Mensalista': { es: 'Mensual', en: 'Monthly' },
        'Horista': { es: 'Por hora', en: 'Hourly' },
        'Perfil da Vaga': { es: 'Perfil del Puesto', en: 'Job Profile' },
        'Salário e Benefícios': { es: 'Salario y Beneficios', en: 'Salary and Benefits' },
        'Faixa Etária': { es: 'Rango de Edad', en: 'Age Range' },
        'Sexo': { es: 'Sexo', en: 'Gender' },
        'Indiferente': { es: 'Indiferente', en: 'Indifferent' },
        'Masculino': { es: 'Masculino', en: 'Male' },
        'Feminino': { es: 'Femenino', en: 'Female' },
        'Detalhamento do Perfil / Atividades': { es: 'Detalle del Perfil / Actividades', en: 'Profile / Activities Details' },
        'Experiência': { es: 'Experiencia', en: 'Experience' },
        'Formação': { es: 'Formación', en: 'Education' },
        'Requisitos': { es: 'Requisitos', en: 'Requirements' },
        'Observação': { es: 'Observación', en: 'Observation' },
        'E-mail do Gestor/Solicitante': { es: 'Correo del Gestor/Solicitante', en: 'Manager/Requester Email' },
        // Taxas
        'SELECIONE O COLABORADOR (Preenchimento Automático)': { es: 'SELECCIONE EL COLABORADOR (Relleno Automático)', en: 'SELECT EMPLOYEE (Auto-fill)' },
        'Carregando colaboradores...': { es: 'Cargando colaboradores...', en: 'Loading employees...' },
        'Dados da Taxa': { es: 'Datos de la Tasa', en: 'Fee Data' },
        'Nome Completo': { es: 'Nombre Completo', en: 'Full Name' },
        'CPF': { es: 'CPF', en: 'CPF' },
        'Função': { es: 'Función', en: 'Role' },
        'Dados Bancários': { es: 'Datos Bancarios', en: 'Banking Data' },
        'SELECIONE A FORMA DE PAGAMENTO *': { es: 'SELECCIONE LA FORMA DE PAGO *', en: 'SELECT PAYMENT METHOD *' },
        'Selecione...': { es: 'Seleccione...', en: 'Select...' },
        'Transferência Bancária': { es: 'Transferencia Bancaria', en: 'Bank Transfer' },
        'PIX': { es: 'PIX', en: 'PIX' },
        'Banco': { es: 'Banco', en: 'Bank' },
        'Agência': { es: 'Agencia', en: 'Branch' },
        'Conta com Dígito': { es: 'Cuenta con Dígito', en: 'Account with Check Digit' },
        'Tipo de Conta': { es: 'Tipo de Cuenta', en: 'Account Type' },
        'Corrente': { es: 'Corriente', en: 'Checking' },
        'Poupança': { es: 'Ahorros', en: 'Savings' },
        'Chave PIX': { es: 'Clave PIX', en: 'PIX Key' },
        'Motivo': { es: 'Motivo', en: 'Reason' },
        'Evento': { es: 'Evento', en: 'Event' },
        'Vaga Aberta (Antecessor)': { es: 'Vacante Abierta (Predecesor)', en: 'Open Position (Predecessor)' },
        'Valores': { es: 'Valores', en: 'Values' },
        'Item': { es: 'Ítem', en: 'Item' },
        'Valor Unitário': { es: 'Valor Unitario', en: 'Unit Value' },
        'Quantidade (Dias)': { es: 'Cantidad (Días)', en: 'Quantity (Days)' },
        'Total': { es: 'Total', en: 'Total' },
        'TAXA': { es: 'TASA', en: 'FEE' },
        'VT': { es: 'VT', en: 'VT' },
        'TOTAL': { es: 'TOTAL', en: 'TOTAL' },
        'Dias Trabalhados': { es: 'Días Trabajados', en: 'Worked Days' },
        'Dia da Semana': { es: 'Día de la Semana', en: 'Day of the Week' },
        'Segunda-feira': { es: 'Lunes', en: 'Monday' },
        'Terça-feira': { es: 'Martes', en: 'Tuesday' },
        'Quarta-feira': { es: 'Miércoles', en: 'Wednesday' },
        'Quinta-feira': { es: 'Jueves', en: 'Thursday' },
        'Sexta-feira': { es: 'Viernes', en: 'Friday' },
        'Sábado': { es: 'Sábado', en: 'Saturday' },
        'Domingo': { es: 'Domingo', en: 'Sunday' },
        '+ Adicionar Data': { es: '+ Añadir Fecha', en: '+ Add Date' },
        'Assinaturas': { es: 'Firmas', en: 'Signatures' },
        'Assinatura do Taxa (Colaborador)': { es: 'Firma del Tasa (Colaborador)', en: 'Fee Worker Signature (Employee)' },
        'A assinatura será solicitada após aprovação do RH': { es: 'La firma será solicitada tras la aprobación de RR. HH.', en: 'Signature will be requested after HR approval' },
        'Assinatura Líder/Gestor': { es: 'Firma Líder/Gestor', en: 'Leader/Manager Signature' },
        'E-mail do Líder/Gestor (para aprovação)': { es: 'Correo del Líder/Gestor (para aprobación)', en: 'Leader/Manager Email (for approval)' },
        'Seu E-mail (para notificação)': { es: 'Su Correo (para notificación)', en: 'Your Email (for notification)' },
        // Kanban Candidatos (colunas e estados)
        'Novos': { es: 'Nuevos', en: 'New' },
        'Em Análise': { es: 'En Análisis', en: 'In Review' },
        'Entrevista': { es: 'Entrevista', en: 'Interview' },
        'Entrevista Agendada': { es: 'Entrevista Programada', en: 'Interview Scheduled' },
        'Contratados': { es: 'Contratados', en: 'Hired' },
        'Arquivados': { es: 'Archivados', en: 'Archived' },
        'Nenhum candidato': { es: 'Ningún candidato', en: 'No candidates' },
        // Recrutamento Interno
        'Dados da Vaga': { es: 'Datos de la Vacante', en: 'Job Data' },
        'Cargo Pretendido': { es: 'Cargo Pretendido', en: 'Desired Position' },
        'Nome Completo': { es: 'Nombre Completo', en: 'Full Name' },
        'Cargo Atual': { es: 'Cargo Actual', en: 'Current Role' },
        'Data Admissão': { es: 'Fecha de Admisión', en: 'Hire Date' },
        'Tempo no cargo': { es: 'Tiempo en el cargo', en: 'Time in role' },
        'Salário Atual (R$)': { es: 'Salario Actual (R$)', en: 'Current Salary (R$)' },
        'Telefone': { es: 'Teléfono', en: 'Phone' },
        'Formação Acadêmica': { es: 'Formación Académica', en: 'Academic Background' },
        'Anexar cópia dos certificados se necessário (entregar ao RH)': { es: 'Adjuntar copia de los certificados si es necesario (entregar a RR. HH.)', en: 'Attach certificate copies if needed (deliver to HR)' },
        'Descreva sua formação': { es: 'Describa su formación', en: 'Describe your education' },
        'Cursos Complementares': { es: 'Cursos Complementarios', en: 'Complementary Courses' },
        'Descreva seus cursos': { es: 'Describa sus cursos', en: 'Describe your courses' },
        'Expectativas': { es: 'Expectativas', en: 'Expectations' },
        'Quais são suas expectativas para o novo cargo?': { es: '¿Cuáles son sus expectativas para el nuevo cargo?', en: 'What are your expectations for the new role?' },
        'Disponibilidade': { es: 'Disponibilidad', en: 'Availability' },
        'Você tem disponibilidade para trabalhar em qualquer turno?': { es: '¿Tiene disponibilidad para trabajar en cualquier turno?', en: 'Are you available to work any shift?' },
        'Por quê? (Justifique se necessário)': { es: '¿Por qué? (Justifique si es necesario)', en: 'Why? (Justify if necessary)' },
        // Avaliação de Experiência
        'Colaborador': { es: 'Colaborador', en: 'Employee' },
        'Avaliador': { es: 'Evaluador', en: 'Reviewer' },
        'Cargo': { es: 'Cargo', en: 'Role' },
        'Data Admissão': { es: 'Fecha de Admisión', en: 'Hire Date' },
        'Parecer da Avaliação': { es: 'Dictamen de la Evaluación', en: 'Evaluation Verdict' },
        '45 DIAS': { es: '45 DÍAS', en: '45 DAYS' },
        '90 DIAS': { es: '90 DÍAS', en: '90 DAYS' },
        'REPROVADO': { es: 'REPROBADO', en: 'FAILED' },
        'PRORROGADO/APROVADO': { es: 'PRORROGADO/APROBADO', en: 'EXTENDED/APPROVED' },
        'APROVADO': { es: 'APROBADO', en: 'APPROVED' },
        'Legenda:': { es: 'Leyenda:', en: 'Legend:' },
        'N - Não se aplica': { es: 'N - No aplica', en: 'N - Not applicable' },
        'NA - Não atende': { es: 'NA - No atiende', en: 'NA - Does not meet' },
        'M - Melhorar': { es: 'M - Mejorar', en: 'M - Improve' },
        'R - Regular': { es: 'R - Regular', en: 'R - Fair' },
        'B - Bom': { es: 'B - Bueno', en: 'B - Good' },
        'E - Excelente': { es: 'E - Excelente', en: 'E - Excellent' },
        'Critérios de Avaliação': { es: 'Criterios de Evaluación', en: 'Evaluation Criteria' },
        '45 Dias': { es: '45 Días', en: '45 Days' },
        '90 Dias': { es: '90 Días', en: '90 Days' },
        'Metas e Desenvolvimento': { es: 'Metas y Desarrollo', en: 'Goals and Development' },
        'Metas: Conhecimentos e habilidades a serem desenvolvidas e/ou aperfeiçoadas': { es: 'Metas: Conocimientos y habilidades a desarrollar y/o perfeccionar', en: 'Goals: Knowledge and skills to develop and/or improve' },
        'Indicação de treinamento para suprir as necessidades indicadas': { es: 'Indicación de capacitación para cubrir las necesidades indicadas', en: 'Training recommendation to address identified needs' },
        'Comentários (Opcional)': { es: 'Comentarios (Opcional)', en: 'Comments (Optional)' },
        '1. COMPROMETIMENTO': { es: '1. COMPROMISO', en: '1. COMMITMENT' },
        'Comprimento de regras': { es: 'Cumplimiento de reglas', en: 'Compliance with rules' },
        'Realização de atividades estipuladas pela liderança': { es: 'Realización de actividades estipuladas por el liderazgo', en: 'Completion of tasks set by leadership' },
        'Pontualidade': { es: 'Puntualidad', en: 'Punctuality' },
        'Resolução de problemas': { es: 'Resolución de problemas', en: 'Problem solving' },
        '2. COMUNICAÇÃO': { es: '2. COMUNICACIÓN', en: '2. COMMUNICATION' },
        'Comunicação com colegas, líderes e demais envolvidos': { es: 'Comunicación con colegas, líderes y demás involucrados', en: 'Communication with colleagues, leaders and others' },
        'Comunicação escrita': { es: 'Comunicación escrita', en: 'Written communication' },
        'Entendimento sobre preocupações e necessidades': { es: 'Entendimiento de preocupaciones y necesidades', en: 'Understanding concerns and needs' },
        'Objetividade': { es: 'Objetividad', en: 'Objectivity' },
        'Profissionalismo': { es: 'Profesionalismo', en: 'Professionalism' },
        'Adaptação a diferentes ambientes': { es: 'Adaptación a diferentes entornos', en: 'Adaptation to different environments' },
        'Simpatia': { es: 'Simpatía', en: 'Friendliness' },
        '3. ORGANIZAÇÃO E PLANEJAMENTO': { es: '3. ORGANIZACIÓN Y PLANIFICACIÓN', en: '3. ORGANIZATION AND PLANNING' },
        'Organização com execução de atividades': { es: 'Organización en la ejecución de actividades', en: 'Organization in task execution' },
        'Planejamento de atividades, com definição e gerenciamento de prioridades': { es: 'Planificación de actividades, con definición y gestión de prioridades', en: 'Activity planning, setting and managing priorities' },
        '4. RELACIONAMENTO INTERPESSOAL': { es: '4. RELACIÓN INTERPERSONAL', en: '4. INTERPERSONAL RELATIONSHIP' },
        'Relacionamento interpessoal (colegas e líderes)': { es: 'Relación interpersonal (colegas y líderes)', en: 'Interpersonal relationship (colleagues and leaders)' },
        'Mantém ambiente favorável ao convívio e à execução do trabalho': { es: 'Mantiene un ambiente favorable a la convivencia y al trabajo', en: 'Maintains a positive environment for work and coexistence' },
        '5. TRABALHO EM EQUIPE': { es: '5. TRABAJO EN EQUIPO', en: '5. TEAMWORK' },
        'Cooperação e interação com os demais membros da equipe': { es: 'Cooperación e interacción con otros miembros del equipo', en: 'Cooperation and interaction with team members' },
        'Sabe ouvir e respeitar posições contrárias': { es: 'Sabe escuchar y respetar posiciones contrarias', en: 'Listens and respects opposing views' },
        'Estabelecimento de credibilidade ao interagir com funcionários, clientes internos e externos': { es: 'Establecimiento de credibilidad al interactuar con empleados y clientes', en: 'Builds credibility with employees and customers' },
        '6. CONHECIMENTO TÉCNICO': { es: '6. CONOCIMIENTO TÉCNICO', en: '6. TECHNICAL KNOWLEDGE' },
        'Aplicação de conhecimento técnico com necessidade de supervisão': { es: 'Aplicación de conocimiento técnico con necesidad de supervisión', en: 'Applies technical knowledge with supervision' },
        'Aplicação de conhecimento técnico sem necessidade de supervisão': { es: 'Aplicación de conocimiento técnico sin necesidad de supervisión', en: 'Applies technical knowledge without supervision' },
        '7. DESENVOLVIMENTO PROFISSIONAL': { es: '7. DESARROLLO PROFESIONAL', en: '7. PROFESSIONAL DEVELOPMENT' },
        'Proativo com atividades não designadas': { es: 'Proactivo con actividades no asignadas', en: 'Proactive with unassigned tasks' },
        'Busca aperfeiçoamento de competências por meio de treinamentos': { es: 'Busca perfeccionar competencias mediante capacitaciones', en: 'Seeks to improve skills via training' },
        'Busca constante de desenvolvimento pessoal e profissional': { es: 'Búsqueda constante de desarrollo personal y profesional', en: 'Constant pursuit of personal and professional development' },
        '8. DISCIPLINA': { es: '8. DISCIPLINA', en: '8. DISCIPLINE' },
        'Demonstra ser disciplinado com regras ou ordens': { es: 'Demuestra ser disciplinado con reglas u órdenes', en: 'Demonstrates discipline with rules or orders' },
        'Cumprimento regras e respeita as diretrizes': { es: 'Cumple reglas y respeta las directrices', en: 'Follows rules and respects guidelines' },
        'Perfil receptivo, entendendo a necessidade do direcionamento e das regras': { es: 'Perfil receptivo, entiende la necesidad de dirección y reglas', en: 'Receptive, understands the need for guidance and rules' },
        'Aceita bem as regras, recebe com presteza as orientações': { es: 'Acepta bien las reglas, recibe las orientaciones con prontitud', en: 'Accepts rules well and receives guidance promptly' },
        '9. HÁBITOS DE SEGURANÇA': { es: '9. HÁBITOS DE SEGURIDAD', en: '9. SAFETY HABITS' },
        'Respeita as normas de segurança e utilização dos EPIS': { es: 'Respeta las normas de seguridad y uso de EPIs', en: 'Respects safety standards and PPE use' },
        'Conhecimento com as normas básicas de segurança e age de forma a evitar acidentes': { es: 'Conoce normas básicas de seguridad y actúa para evitar accidentes', en: 'Knows basic safety standards and acts to avoid accidents' },
        '10. SOLUÇÃO DE PROBLEMAS': { es: '10. SOLUCIÓN DE PROBLEMAS', en: '10. PROBLEM SOLVING' },
        'Identificação de problemas': { es: 'Identificación de problemas', en: 'Problem identification' },
        'Apresentação de ideias para solução de problemas': { es: 'Presentación de ideas para solucionar problemas', en: 'Proposes ideas to solve problems' },
        'Apresentação de novas ideias e recursos para aprimorar técnicas': { es: 'Presentación de nuevas ideas y recursos para mejorar técnicas', en: 'Presents new ideas and resources to improve techniques' },
        // Entrevista de Desligamento (protegido)
        'Formulário de Desligamento': { es: 'Formulario de Desvinculación', en: 'Termination Form' },
        'Por favor, preencha as informações abaixo.': { es: 'Por favor, complete la información a continuación.', en: 'Please fill in the information below.' },
        'Nome': { es: 'Nombre', en: 'Name' },
        'Cargo': { es: 'Cargo', en: 'Role' },
        'Data Admissão': { es: 'Fecha de Admisión', en: 'Hire Date' },
        'Chefe Imediato': { es: 'Jefe Inmediato', en: 'Immediate Supervisor' },
        'Armário': { es: 'Taquilla', en: 'Locker' },
        'TIPO DE DESLIGAMENTO': { es: 'TIPO DE DESVINCULACIÓN', en: 'TYPE OF TERMINATION' },
        'Sem justa causa': { es: 'Sin justa causa', en: 'Without cause' },
        'Por justa causa': { es: 'Por justa causa', en: 'With cause' },
        'Pedido do colaborador': { es: 'Pedido del colaborador', en: 'Employee request' },
        'Distrato': { es: 'Distracto', en: 'Termination agreement' },
        'Término do estágio': { es: 'Fin de la pasantía', en: 'End of internship' },
        'Aposentadoria': { es: 'Jubilación', en: 'Retirement' },
        'Outros': { es: 'Otros', en: 'Others' },
        'MOTIVO DO DESLIGAMENTO': { es: 'MOTIVO DE LA DESVINCULACIÓN', en: 'REASON FOR TERMINATION' },
        'Por Pedido:': { es: 'Por Solicitud:', en: 'By Request:' },
        'Por Dispensa:': { es: 'Por Despido:', en: 'By Dismissal:' },
        'Salário': { es: 'Salario', en: 'Salary' },
        'Oportunidade de trabalho': { es: 'Oportunidad de trabajo', en: 'Job opportunity' },
        'Horário de trabalho': { es: 'Horario de trabajo', en: 'Work schedule' },
        'Ambiente de trabalho': { es: 'Ambiente de trabajo', en: 'Work environment' },
        'Desmotivação': { es: 'Desmotivación', en: 'Lack of motivation' },
        'Problemas pessoais / familiares': { es: 'Problemas personales / familiares', en: 'Personal / family issues' },
        'Baixo desempenho': { es: 'Bajo desempeño', en: 'Low performance' },
        'Pontualidade, assiduidade': { es: 'Puntualidad, asistencia', en: 'Punctuality, attendance' },
        'Não cumprimento de normas': { es: 'Incumplimiento de normas', en: 'Failure to follow rules' },
        'Redução do quadro': { es: 'Reducción de plantilla', en: 'Workforce reduction' },
        'Relacionamento com chefia': { es: 'Relación con jefatura', en: 'Relationship with management' },
        'Relacionamento com colegas': { es: 'Relación con colegas', en: 'Relationship with colleagues' },
        'PERGUNTAS FINAIS': { es: 'PREGUNTAS FINALES', en: 'FINAL QUESTIONS' },
        'Como você percebia o atendimento do setor de RH?': { es: '¿Cómo percibía la atención del sector de RR. HH.?', en: 'How did you perceive HR service?' },
        'Indicaria a empresa?': { es: '¿Recomendaría la empresa?', en: 'Would you recommend the company?' },
        'Por quê?': { es: '¿Por qué?', en: 'Why?' },
        'Voltaria a trabalhar?': { es: '¿Volvería a trabajar?', en: 'Would you return to work?' },
        'Em que condições?': { es: '¿En qué condiciones?', en: 'Under what conditions?' },
        'Nota (0 a 10)': { es: 'Nota (0 a 10)', en: 'Score (0 to 10)' },
        'Comentários': { es: 'Comentarios', en: 'Comments' },
        'Observações adicionais...': { es: 'Observaciones adicionales...', en: 'Additional remarks...' },
        // Tabela de avaliação (entrevista)
        'Item': { es: 'Ítem', en: 'Item' },
        'Ótimo (O)': { es: 'Óptimo (O)', en: 'Excellent (E)' },
        'Bom (B)': { es: 'Bueno (B)', en: 'Good (G)' },
        'Regular (Rg)': { es: 'Regular (Rg)', en: 'Fair (F)' },
        'Ruim (Ru)': { es: 'Malo (Ru)', en: 'Poor (P)' },
        'BENEFÍCIOS': { es: 'BENEFICIOS', en: 'BENEFITS' },
        'Alimentação - Variedade': { es: 'Alimentación - Variedad', en: 'Food - Variety' },
        'Alimentação - Qualidade': { es: 'Alimentación - Calidad', en: 'Food - Quality' },
        'Alimentação - Quantidade': { es: 'Alimentación - Cantidad', en: 'Food - Quantity' },
        'Convênio Paraná Clínica': { es: 'Convenio Paraná Clínica', en: 'Paraná Clinic Agreement' },
        'Convênio OdontoPrev': { es: 'Convenio OdontoPrev', en: 'OdontoPrev Agreement' },
        'Cartão Alimentação Senff': { es: 'Tarjeta Alimentación Senff', en: 'Senff Food Card' },
        'Cartão Crédito Senff': { es: 'Tarjeta Crédito Senff', en: 'Senff Credit Card' },
        'Empréstimo Consignado Itaú': { es: 'Préstamo Consignado Itaú', en: 'Itaú Payroll Loan' },
        'Treinamentos': { es: 'Entrenamientos', en: 'Training' },
        'COMUNICAÇÃO': { es: 'COMUNICACIÓN', en: 'COMMUNICATION' },
        'Recursos de comunicação': { es: 'Recursos de comunicación', en: 'Communication resources' },
        'Qualidade das informações': { es: 'Calidad de la información', en: 'Information quality' },
        'Periodicidade das informações': { es: 'Periodicidad de la información', en: 'Information frequency' },
        'Variedade das informações': { es: 'Variedad de la información', en: 'Information variety' },
        'AMBIENTE DE TRABALHO': { es: 'AMBIENTE DE TRABAJO', en: 'WORK ENVIRONMENT' },
        'Iluminação': { es: 'Iluminación', en: 'Lighting' },
        'Ruído': { es: 'Ruido', en: 'Noise' },
        'Ventilação': { es: 'Ventilación', en: 'Ventilation' },
        'Espaço físico': { es: 'Espacio físico', en: 'Physical space' },
        'Sanitários': { es: 'Sanitarios', en: 'Restrooms' },
        'Organização / Limpeza': { es: 'Organización / Limpieza', en: 'Organization / Cleanliness' },
        'Segurança': { es: 'Seguridad', en: 'Safety' },
        'RELACIONAMENTOS': { es: 'RELACIONES', en: 'RELATIONSHIPS' },
        'Chefia': { es: 'Jefatura', en: 'Management' },
        'Colegas': { es: 'Colegas', en: 'Colleagues' },
        'Gerência / Empresa / Diretoria': { es: 'Gerencia / Empresa / Dirección', en: 'Management / Company / Board' },
        'Clientes': { es: 'Clientes', en: 'Customers' },
        // Avaliações
        'Dados da Avaliação': { es: 'Datos de la Evaluación', en: 'Evaluation Data' },
        'Funcionário(a) Avaliado(a):': { es: 'Empleado(a) Evaluado(a):', en: 'Employee Evaluated:' },
        'Data:': { es: 'Fecha:', en: 'Date:' },
        'Função:': { es: 'Función:', en: 'Role:' },
        'Setor:': { es: 'Sector:', en: 'Department:' },
        'Avaliador (Seu Nome):': { es: 'Evaluador (Su Nombre):', en: 'Reviewer (Your Name):' },
        'Avaliação Final e Compromisso': { es: 'Evaluación Final y Compromiso', en: 'Final Evaluation and Commitment' },
        'Assinale o Indicador de Status Profissional:': { es: 'Marque el Indicador de Estado Profesional:', en: 'Mark the Professional Status Indicator:' },
        'DESMOTIVADO': { es: 'DESMOTIVADO', en: 'DEMOTIVATED' },
        'POUCO MOTIVADO': { es: 'POCO MOTIVADO', en: 'LOW MOTIVATION' },
        'NEUTRO': { es: 'NEUTRO', en: 'NEUTRAL' },
        'MOTIVADO': { es: 'MOTIVADO', en: 'MOTIVATED' },
        'MUITO MOTIVADO': { es: 'MUY MOTIVADO', en: 'HIGHLY MOTIVATED' },
        'Por que? Comente:': { es: '¿Por qué? Comente:', en: 'Why? Comment:' },
        'Li e concordo': { es: 'Leí y estoy de acuerdo', en: 'I have read and agree' },
        // Departamentos (opções)
        'Salão': { es: 'Salón', en: 'Dining Room' },
        'Cozinha': { es: 'Cocina', en: 'Kitchen' },
        'Bar': { es: 'Bar', en: 'Bar' },
        'Limpeza': { es: 'Limpieza', en: 'Cleaning' },
        'Estoque': { es: 'Almacén', en: 'Stockroom' },
        'Manutenção': { es: 'Mantenimiento', en: 'Maintenance' },
        'Outros': { es: 'Otros', en: 'Others' }
    };

    const applyTranslations = (lang) => {
        const dict = translations[lang];
        if (!dict) return;
        document.querySelectorAll('[data-translate]').forEach(el => {
            const key = el.getAttribute('data-translate');
            const val = dict[key];
            if (!val) return;
            if (el.placeholder !== undefined && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
                el.placeholder = val;
            } else {
                if (typeof val === 'string' && val.includes('<')) {
                    el.innerHTML = val;
                } else {
                    el.textContent = val;
                }
            }
        });
        // Fallback: translate common text labels when they exactly match PT strings
        const candidates = document.querySelectorAll('label, span, p, h1, h2, h3, th, td, button, div, .form-section-title, .section-title');
        candidates.forEach(el => {
            if (el.hasAttribute && el.hasAttribute('data-translate')) return;
            // If simple node (no element children), replace directly
            const elementChildren = Array.from(el.childNodes).filter(n => n.nodeType === 1);
            if (elementChildren.length === 0) {
                const txt = (el.textContent || '').trim();
                if (textMap[txt] && textMap[txt][lang]) {
                    el.textContent = textMap[txt][lang];
                }
                return;
            }
            // Complex node: translate only text nodes to preserve children
            Array.from(el.childNodes).forEach(node => {
                if (node.nodeType !== 3) return; // not a text node
                const original = node.nodeValue || '';
                const trimmed = original.trim();
                if (!trimmed) return;
                const mapped = textMap[trimmed] && textMap[trimmed][lang];
                if (mapped) {
                    const leading = original.match(/^\s*/)?.[0] ?? '';
                    const trailing = original.match(/\s*$/)?.[0] ?? '';
                    node.nodeValue = leading + mapped + trailing;
                }
            });
        });
        // Also translate simple emphasis nodes like <strong> and <b>
        document.querySelectorAll('strong, b').forEach(el => {
            const txt = (el.textContent || '').trim();
            if (textMap[txt] && textMap[txt][lang]) {
                el.textContent = textMap[txt][lang];
            }
        });
        // Translate option texts (including empty-value placeholder options)
        document.querySelectorAll('select option').forEach(opt => {
            const txt = (opt.textContent || '').trim();
            if (!txt) return;
            let mapped = null;
            // First, try direct text map
            if (textMap[txt] && textMap[txt][lang]) {
                mapped = textMap[txt][lang];
            }
            // Then try placeholder map (match by PT text)
            if (!mapped) {
                for (const key in placeholderMap) {
                    if (placeholderMap[key].pt === txt) { mapped = placeholderMap[key][lang]; break; }
                }
            }
            if (mapped) {
                opt.textContent = mapped;
            }
        });
        document.querySelectorAll('input[placeholder], textarea[placeholder]').forEach(el => {
            const ph = (el.getAttribute('placeholder') || '').trim();
            let k = el.dataset.placeholderKey;
            if (!k) {
                for (const key in placeholderMap) {
                    if (placeholderMap[key].pt === ph) { k = key; break; }
                }
                if (k) el.dataset.placeholderKey = k;
            }
            if (k && placeholderMap[k] && placeholderMap[k][lang]) {
                el.placeholder = placeholderMap[k][lang];
            }
        });
        document.querySelectorAll('select option[value=""]').forEach(opt => {
            const txt = (opt.textContent || '').trim();
            let k = opt.dataset.placeholderKey;
            if (!k) {
                for (const key in placeholderMap) {
                    if (placeholderMap[key].pt === txt) { k = key; break; }
                }
                if (k) opt.dataset.placeholderKey = k;
            }
            if (k && placeholderMap[k] && placeholderMap[k][lang]) {
                opt.textContent = placeholderMap[k][lang];
            }
        });
        const pageAttr = document.body && document.body.getAttribute && document.body.getAttribute('data-page');
        if (pageAttr === 'index' && dict.idx_title) {
            document.title = dict.idx_title;
        }
        if (pageAttr === 'rh-index' && dict.rh_title) {
            document.title = dict.rh_title;
        }
        if (pageAttr === 'rh-ferias' && dict.rh_ferias_title) {
            document.title = dict.rh_ferias_title;
        }
        if (pageAttr === 'rh-taxas' && dict.rh_taxas_title) {
            document.title = dict.rh_taxas_title;
        }
        if (pageAttr === 'rh-candidatos' && dict.rh_dash_candidatos_title) {
            document.title = dict.rh_dash_candidatos_title;
        }
        if (pageAttr === 'rh-recrutamento' && dict.rh_dash_recrutamento_title) {
            document.title = dict.rh_dash_recrutamento_title;
        }
        if (pageAttr === 'rh-onthejob' && dict.rh_dash_onthejob_title) {
            document.title = dict.rh_dash_onthejob_title;
        }
        if (pageAttr === 'rh-vagas' && dict.rh_dash_vagas_title) {
            document.title = dict.rh_dash_vagas_title;
        }
        if (pageAttr === 'rh-epis' && dict.rh_dash_epis_title) {
            document.title = dict.rh_dash_epis_title;
        }
        if (pageAttr === 'rh-portaria' && dict.rh_card_portaria_title) {
            document.title = dict.rh_card_portaria_title;
        }
        if (pageAttr === 'rh-funcionarios' && dict.rh_dash_funcionarios_title) {
            document.title = dict.rh_dash_funcionarios_title;
        }
        if (pageAttr === 'rh-avaliacoes' && dict.rh_dash_avaliacoes_title) {
            document.title = dict.rh_dash_avaliacoes_title;
        }
        if (pageAttr === 'rh-experiencia' && dict.rh_dash_experiencia_title) {
            document.title = dict.rh_dash_experiencia_title;
        }
        if (pageAttr === 'rh-formularios' && dict.rh_dash_formularios_title) {
            document.title = dict.rh_dash_formularios_title;
        }
        if (pageAttr === 'rh-desligamento' && dict.rh_dash_desligamento_title) {
            document.title = dict.rh_dash_desligamento_title;
        }
        if (pageAttr === 'rh-req-taxas' && dict.rh_dash_req_taxas_title) {
            document.title = dict.rh_dash_req_taxas_title;
        }
        if (pageAttr === 'rh-usuarios' && dict.rh_dash_usuarios_title) {
            document.title = dict.rh_dash_usuarios_title;
        }
        if (pageAttr === 'rh-entrevista-desligamento' && dict.rh_exit_form_title) {
            document.title = dict.rh_exit_form_title;
        }
        if (pageAttr === 'login' && dict.login_title) {
            document.title = dict.login_title;
        }
        if (pageAttr === 'ferias' && dict.ferias_title) {
            document.title = dict.ferias_title;
        }
        if (pageAttr === 'vagas' && dict.vagas_title) {
            document.title = dict.vagas_title;
        }
        if (pageAttr === 'taxas' && dict.taxas_title) {
            document.title = dict.taxas_title;
        }
        if (pageAttr === 'solicitacao-taxa' && dict.solicitacao_taxa_title) {
            document.title = dict.solicitacao_taxa_title;
        }
        if (pageAttr === 'onthejob' && dict.onthejob_title) {
            document.title = dict.onthejob_title;
        }
        if (pageAttr === 'recrutamento-interno' && dict.recrutamento_title) {
            document.title = dict.recrutamento_title;
        }
        if (pageAttr === 'avaliacao-operacional' && dict.avaliacao_operacional_title) {
            document.title = dict.avaliacao_operacional_title;
        }
        if (pageAttr === 'avaliacao-adm' && dict.avaliacao_adm_title) {
            document.title = dict.avaliacao_adm_title;
        }
        if (pageAttr === 'avaliacao-lideranca' && dict.avaliacao_lideranca_title) {
            document.title = dict.avaliacao_lideranca_title;
        }
        if (pageAttr === 'avaliacao-experiencia' && dict.avaliacao_experiencia_title) {
            document.title = dict.avaliacao_experiencia_title;
        }
        if (pageAttr === 'trabalhe-conosco' && dict.trabalhe_title) {
            document.title = dict.trabalhe_title;
        }
        if (pageAttr === 'solicitacao-epi' && dict.epi_title) {
            document.title = dict.epi_title;
        }
        if (pageAttr === 'responder-formulario' && dict.responder_form_loading) {
            document.title = dict.responder_form_loading;
        }
    };

    const ensureStyle = () => {
        if (document.getElementById('lang-switcher-style')) return;
        const style = document.createElement('style');
        style.id = 'lang-switcher-style';
        style.textContent = `
.language-switcher{
  position: fixed !important;
  top: 16px !important;
  right: 16px !important;
  top: calc(env(safe-area-inset-top, 0px) + 16px) !important;
  right: calc(env(safe-area-inset-right, 0px) + 16px) !important;
  z-index: 2147483647 !important;
  pointer-events: auto !important;
  left: auto !important;
  bottom: auto !important;
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
}

.rh-mobile-header .language-switcher{
  position: fixed !important;
  top: 12px !important;
  right: 12px !important;
  top: calc(env(safe-area-inset-top, 0px) + 12px) !important;
  right: calc(env(safe-area-inset-right, 0px) + 12px) !important;
  left: auto !important;
  bottom: auto !important;
  z-index: 2147483647 !important;
  transform: none !important;
  pointer-events: auto !important;
  margin-left: 0 !important;
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
}

.language-switcher .lang-card{
  display:flex;
  align-items:center;
  gap:2px;
  padding:0;
  border-radius:0;
  border:0;
  background:transparent;
  box-shadow:none;
  pointer-events: auto;
}
.language-switcher .lang-group{
  display:inline-flex;
  gap:2px;
  border-radius:999px;
  border:0;
  overflow:visible;
  background:transparent;
}
.language-switcher .lang-btn{
  appearance:none;
  border:1px solid var(--border-color, var(--border, #e5e7eb));
  background:transparent;
  padding:2px;
  min-height:30px;
  min-width:30px;
  display:flex;
  align-items:center;
  justify-content:center;
  cursor:pointer;
  color:var(--text-primary, var(--text-main, var(--text, #1f2937)));
  border-radius:999px;
}
.language-switcher .lang-btn + .lang-btn{
  border-left:0;
}
.language-switcher .lang-btn:hover{
  background:var(--control-hover-bg, rgba(148,163,184,0.18));
}
.language-switcher .lang-btn[aria-pressed="true"]{
  background:var(--control-active-bg, rgba(37,99,235,0.12));
  color:var(--accent, var(--primary-color, #2563eb));
  box-shadow:none;
}
.language-switcher .lang-btn[aria-pressed="true"] .lang-flag{
  box-shadow:inset 0 0 0 1px var(--accent, var(--primary-color, #2563eb));
}
.language-switcher .lang-btn:focus-visible{
  outline:3px solid rgba(37,99,235,0.35);
  outline-offset:2px;
}
.language-switcher .lang-btn:active{
  transform:translateY(1px);
}
.language-switcher .lang-flag{
  width:14px;
  height:10px;
  border-radius:3px;
  background-size:cover;
  background-position:center;
  box-shadow:inset 0 0 0 1px rgba(15,23,42,0.18);
}
.language-switcher .lang-btn[data-lang="pt"] .lang-flag{
  background-image:url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2028%2020%22%3E%3Crect%20width%3D%2228%22%20height%3D%2220%22%20fill%3D%22%23009b3a%22/%3E%3Cpolygon%20points%3D%2214%2C1%2027%2C10%2014%2C19%201%2C10%22%20fill%3D%22%23ffdf00%22/%3E%3Ccircle%20cx%3D%2214%22%20cy%3D%2210%22%20r%3D%225%22%20fill%3D%22%23002776%22/%3E%3C/svg%3E");
}
.language-switcher .lang-btn[data-lang="es"] .lang-flag{
  background-image:url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2028%2020%22%3E%3Crect%20width%3D%2228%22%20height%3D%2220%22%20fill%3D%22%23aa151b%22/%3E%3Crect%20y%3D%225%22%20width%3D%2228%22%20height%3D%2210%22%20fill%3D%22%23f1bf00%22/%3E%3C/svg%3E");
}
.language-switcher .lang-btn[data-lang="en"] .lang-flag{
  background-image:url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2028%2020%22%3E%3Crect%20width%3D%2228%22%20height%3D%2220%22%20fill%3D%22%23ffffff%22/%3E%3Crect%20width%3D%2228%22%20height%3D%2220%22%20fill%3D%22%23b22234%22/%3E%3Crect%20y%3D%222%22%20width%3D%2228%22%20height%3D%222%22%20fill%3D%22%23ffffff%22/%3E%3Crect%20y%3D%226%22%20width%3D%2228%22%20height%3D%222%22%20fill%3D%22%23ffffff%22/%3E%3Crect%20y%3D%2210%22%20width%3D%2228%22%20height%3D%222%22%20fill%3D%22%23ffffff%22/%3E%3Crect%20y%3D%2214%22%20width%3D%2228%22%20height%3D%222%22%20fill%3D%22%23ffffff%22/%3E%3Crect%20y%3D%2218%22%20width%3D%2228%22%20height%3D%222%22%20fill%3D%22%23ffffff%22/%3E%3Crect%20width%3D%2212%22%20height%3D%2210%22%20fill%3D%22%233c3b6e%22/%3E%3Ccircle%20cx%3D%223%22%20cy%3D%222%22%20r%3D%220.6%22%20fill%3D%22%23ffffff%22/%3E%3Ccircle%20cx%3D%226%22%20cy%3D%222%22%20r%3D%220.6%22%20fill%3D%22%23ffffff%22/%3E%3Ccircle%20cx%3D%229%22%20cy%3D%222%22%20r%3D%220.6%22%20fill%3D%22%23ffffff%22/%3E%3Ccircle%20cx%3D%224.5%22%20cy%3D%224%22%20r%3D%220.6%22%20fill%3D%22%23ffffff%22/%3E%3Ccircle%20cx%3D%227.5%22%20cy%3D%224%22%20r%3D%220.6%22%20fill%3D%22%23ffffff%22/%3E%3Ccircle%20cx%3D%223%22%20cy%3D%226%22%20r%3D%220.6%22%20fill%3D%22%23ffffff%22/%3E%3Ccircle%20cx%3D%226%22%20cy%3D%226%22%20r%3D%220.6%22%20fill%3D%22%23ffffff%22/%3E%3Ccircle%20cx%3D%229%22%20cy%3D%226%22%20r%3D%220.6%22%20fill%3D%22%23ffffff%22/%3E%3Ccircle%20cx%3D%224.5%22%20cy%3D%228%22%20r%3D%220.6%22%20fill%3D%22%23ffffff%22/%3E%3Ccircle%20cx%3D%227.5%22%20cy%3D%228%22%20r%3D%220.6%22%20fill%3D%22%23ffffff%22/%3E%3C/svg%3E");
}
@media (max-width: 768px) {
  .language-switcher{
    top: calc(env(safe-area-inset-top, 0px) + 12px) !important;
    right: calc(env(safe-area-inset-right, 0px) + 12px) !important;
  }
  .language-switcher .lang-card{ gap: 2px; }
  .language-switcher .lang-btn,
  .language-switcher .theme-btn{
    min-width: 32px;
    min-height: 32px;
    padding: 4px;
  }
  .language-switcher .lang-flag{ width: 16px; height: 12px; }
}
@media (max-width: 420px) {
  .language-switcher .lang-card{ gap: 1px; flex-wrap: wrap; }
  .language-switcher .lang-btn,
  .language-switcher .theme-btn{
    min-width: 28px;
    min-height: 28px;
    padding: 2px;
  }
  .language-switcher .lang-flag{ width: 12px; height: 9px; }
  .rh-mobile-header .language-switcher .lang-card{ flex-wrap: nowrap; }
}
/* Theme buttons */
.language-switcher .theme-group{
  margin-left: 4px;
  display:inline-flex;
  gap:2px;
  border-radius:999px;
  border:0;
  overflow:visible;
  background:transparent;
}
.language-switcher .theme-btn{
  appearance:none;
  border:1px solid var(--border-color, var(--border, #e5e7eb));
  background:transparent;
  padding:2px;
  min-height:30px;
  min-width:30px;
  display:flex;
  align-items:center;
  justify-content:center;
  cursor:pointer;
  color:var(--text-primary, var(--text-main, var(--text, #1f2937)));
  border-radius:999px;
}
.language-switcher .theme-btn + .theme-btn{
  border-left:0;
}
.language-switcher .theme-btn[aria-pressed="true"]{
  background:var(--control-active-bg, rgba(37,99,235,0.12));
  color:var(--accent, var(--primary-color, #2563eb));
  box-shadow:none;
}
        `.trim();
        document.head.appendChild(style);
    };

    const positionSwitcher = (root) => {
        if (!root || !root.style) return;
        const mobileHeader = document.querySelector('.rh-mobile-header');
        const headerVisible = !!(mobileHeader && window.getComputedStyle(mobileHeader).display !== 'none');
        if (headerVisible && mobileHeader.contains(root)) {
            root.style.setProperty('position', 'fixed', 'important');
            root.style.setProperty('top', 'calc(env(safe-area-inset-top, 0px) + 12px)', 'important');
            root.style.setProperty('right', 'calc(env(safe-area-inset-right, 0px) + 12px)', 'important');
            root.style.setProperty('left', 'auto', 'important');
            root.style.setProperty('bottom', 'auto', 'important');
            root.style.setProperty('z-index', '2147483647', 'important');
            root.style.setProperty('pointer-events', 'auto', 'important');
            root.style.setProperty('transform', 'none', 'important');
            root.style.setProperty('margin-left', '0', 'important');
            return;
        }

        root.style.setProperty('position', 'fixed', 'important');
        root.style.setProperty('top', 'calc(env(safe-area-inset-top, 0px) + 16px)', 'important');
        root.style.setProperty('right', 'calc(env(safe-area-inset-right, 0px) + 16px)', 'important');
        root.style.setProperty('left', 'auto', 'important');
        root.style.setProperty('bottom', 'auto', 'important');
        root.style.setProperty('z-index', '2147483647', 'important');
        root.style.setProperty('pointer-events', 'auto', 'important');
        root.style.setProperty('transform', 'none', 'important');
    };

    const ensureMarkup = () => {
        let root = document.querySelector('.language-switcher');
        if (root) return root;

        root = document.createElement('div');
        root.className = 'language-switcher';
        root.innerHTML = `
<div class="lang-card">
  <div class="lang-group" role="group" aria-label="Selecionar idioma">
    <button class="lang-btn" type="button" data-lang="pt" aria-pressed="false" title="Português (Brasil)" aria-label="Português (Brasil)"><span class="lang-flag" aria-hidden="true"></span></button>
    <button class="lang-btn" type="button" data-lang="es" aria-pressed="false" title="Español (España)" aria-label="Español (España)"><span class="lang-flag" aria-hidden="true"></span></button>
    <button class="lang-btn" type="button" data-lang="en" aria-pressed="false" title="English (United States)" aria-label="English (United States)"><span class="lang-flag" aria-hidden="true"></span></button>
  </div>
  <div class="theme-group" role="group" aria-label="Selecionar tema">
    <button class="theme-btn" type="button" data-theme="light" aria-pressed="false" title="Modo Claro" aria-label="Modo Claro">☀️</button>
    <button class="theme-btn" type="button" data-theme="dark" aria-pressed="false" title="Modo Escuro" aria-label="Modo Escuro">🌙</button>
  </div>
</div>
        `.trim();

        document.body.appendChild(root);
        return root;
    };

    const detectTheme = () => {
        try {
            const saved = localStorage.getItem(THEME_KEY);
            if (saved === 'light' || saved === 'dark') return saved;
        } catch {}
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
        return 'light';
    };

    const ensureThemeOverride = () => {
        let el = document.getElementById('theme-override');
        if (!el) {
            el = document.createElement('style');
            el.id = 'theme-override';
            document.head.appendChild(el);
        }
        return el;
    };

    const applyTheme = (theme, { persist } = { persist: true }) => {
        const t = theme === 'dark' ? 'dark' : 'light';
        if (persist) {
            try { localStorage.setItem(THEME_KEY, t); } catch {}
        }
        const styleEl = ensureThemeOverride();
        if (t === 'dark') {
            styleEl.textContent = `
:root{
  /* RH stylesheet variables */
  --bg-body:#0b1220;
  --bg-surface:#111827;
  --border:#334155;
  --text-primary:#e5e7eb;
  --text-secondary:#94a3b8;
  --primary:#e2e8f0;
  --primary-hover:#f8fafc;
  --accent:#60a5fa;
  --accent-hover:#3b82f6;
  --danger:#f87171;
  --success:#22c55e;
  --warning:#f59e0b;
  /* Public form variables */
  --primary-color:#e2e8f0;
  --primary-light:#94a3b8;
  --accent-color:#60a5fa;
  --accent-hover:#3b82f6;
  --success-color:#10b981;
  --success-bg:#052e1a;
  --success-text:#a7f3d0;
  --warning-color:#f59e0b;
  --warning-bg:#2a1b04;
  --warning-text:#fde68a;
  --danger-color:#f87171;
  --danger-bg:#2a0b0b;
  --danger-text:#fecaca;
  --bg-color:#0f172a;
  --card-bg:#111827;
  --border-color:#334155;
  --text-main:#e5e7eb;
  --text-secondary:#94a3b8;
  --table-header-bg:#1f2937;
  --input-bg:#0b1220;
  --table-hover-bg:#0f2130;
  --category-header-bg:#0b1220;
  --category-header-text:#e5e7eb;
  --bg:var(--bg-color);
  --card:var(--card-bg);
  --text:var(--text-main);
  --muted:var(--text-secondary);
  --border:var(--border-color);
  --accent-soft:#0b2a52;
  --hover-bg:#0f2130;
  --overlay-bg:rgba(15,23,42,0.85);
  --shadow-xs:0 1px 2px rgba(0, 0, 0, 0.35);
  --shadow-sm:0 2px 8px rgba(0, 0, 0, 0.35);
  --shadow-md:0 4px 6px -1px rgba(0, 0, 0, 0.45);
  --shadow-lg:0 12px 24px rgba(0, 0, 0, 0.35);
  --focus-ring:0 0 0 3px rgba(96, 165, 250, 0.35);
  --focus-outline:3px solid rgba(96, 165, 250, 0.35);
  --control-hover-bg:rgba(148, 163, 184, 0.16);
  --control-active-bg:rgba(96, 165, 250, 0.16);
  --flag-outline:inset 0 0 0 1px rgba(148, 163, 184, 0.22);
  --backdrop-bg:rgba(0, 0, 0, 0.6);
  --brand-bg:#475569;
  --brand-text:#e5e7eb;
  --orange-bg:#2a1404;
  --yellow-bg:#2a2304;
  --lime-bg:#1a2a04;
  --green-bg:#052e1a;
}
/* Controles desabilitados/read-only com contraste adequado */
body.theme-dark .form-control[readonly],
body.theme-dark .form-control:disabled {
  background-color:var(--bg-surface) !important;
  color:var(--text-secondary) !important;
  border-color:var(--border-color) !important;
}
/* Selects e opções */
body.theme-dark select,
body.theme-dark select.score-select {
  background-color:var(--input-bg) !important;
  color:var(--text-main) !important;
  border-color:var(--border-color) !important;
}
/* Caixas de status */
body.theme-dark .status-box { 
  background: var(--card-bg) !important; 
  border-color: var(--border-color) !important;
}
body.theme-dark #status90Box { 
  background: var(--card-bg) !important; 
}
/* Legenda */
body.theme-dark .legend-box{
  background:var(--accent-soft) !important;
  border-color:var(--border-color) !important;
  color:var(--accent-color) !important;
}
body.theme-dark .legend-item{
  background:var(--card-bg) !important;
  color:var(--text-main) !important;
  border:1px solid var(--border-color) !important;
}

body.theme-dark{
  background-color:var(--bg-color) !important;
  color:var(--text-main) !important;
}

body.theme-dark a{
  color:var(--accent-color) !important;
}

body.theme-dark form,
body.theme-dark .hero,
body.theme-dark .login-modal,
body.theme-dark .login-container,
body.theme-dark .header,
body.theme-dark .table-container,
body.theme-dark .table-wrapper{
  background:var(--card-bg) !important;
  color:var(--text-main) !important;
  border-color:var(--border-color) !important;
}

body.theme-dark input,
body.theme-dark textarea{
  background:var(--input-bg) !important;
  color:var(--text-main) !important;
  border-color:var(--border-color) !important;
}

body.theme-dark .modal-content{
  background:var(--card-bg) !important;
  color:var(--text-main) !important;
  border-color:var(--border-color) !important;
}

body.theme-dark .editor-main{
  background:var(--bg-body) !important;
  color:var(--text-primary) !important;
}

body.theme-dark .editor-sidebar{
  background:var(--bg-surface) !important;
  color:var(--text-primary) !important;
  border-color:var(--border) !important;
}
            `.trim();
            document.body.classList.add('theme-dark');
            document.body.classList.remove('theme-light');
        } else {
            styleEl.textContent = '';
            document.body.classList.add('theme-light');
            document.body.classList.remove('theme-dark');
        }
        const btns = Array.from(document.querySelectorAll('.language-switcher [data-theme]'));
        btns.forEach(b => b.setAttribute('aria-pressed', b.getAttribute('data-theme') === t ? 'true' : 'false'));
    };

    const applyLang = (lang, { persist } = { persist: true }) => {
        const normalized = normalize(lang);
        const cfg = langs.find(l => l.code === normalized) || langs[0];
        document.documentElement.setAttribute('lang', cfg.htmlLang);

        const buttons = Array.from(document.querySelectorAll('.language-switcher [data-lang]'));
        buttons.forEach(btn => {
            btn.setAttribute('aria-pressed', btn.getAttribute('data-lang') === normalized ? 'true' : 'false');
        });

        if (persist) {
            try { localStorage.setItem(STORAGE_KEY, normalized); } catch {}
        }

        if (typeof window.setPageLanguage === 'function') {
            try { window.setPageLanguage(normalized, { persist }); } catch {}
        }

        applyTranslations(normalized);

        try {
            window.dispatchEvent(new CustomEvent('languagechange', { detail: { lang: normalized } }));
        } catch {}
    };

    const main = () => {
        ensureStyle();
        const root = ensureMarkup();
        const placeRoot = () => {
            const mh = document.querySelector('.rh-mobile-header');
            const hv = !!(mh && window.getComputedStyle(mh).display !== 'none');
            if (hv && mh && !mh.contains(root)) mh.appendChild(root);
            if (!hv && root.parentNode !== document.body) document.body.appendChild(root);
            positionSwitcher(root);
            const isPublic = !document.body.classList.contains('with-rh-sidebar');
            if (root.classList) {
                if (isPublic) root.classList.add('is-public');
                else root.classList.remove('is-public');
            }
        };
        placeRoot();
        window.addEventListener('resize', placeRoot);
        try {
            const observer = new MutationObserver(placeRoot);
            observer.observe(document.body, { childList: true, subtree: true });
        } catch {}
        const findLangButton = (target) => {
            if (!target) return null;
            if (target.closest) return target.closest('[data-lang]');
            let el = target;
            while (el && el !== root) {
                if (el.getAttribute && el.getAttribute('data-lang')) return el;
                el = el.parentNode;
            }
            return null;
        };
        const findThemeButton = (target) => {
            if (!target) return null;
            if (target.closest) return target.closest('[data-theme]');
            let el = target;
            while (el && el !== root) {
                if (el.getAttribute && el.getAttribute('data-theme')) return el;
                el = el.parentNode;
            }
            return null;
        };
        root.addEventListener('click', (e) => {
            const lbtn = findLangButton(e.target);
            if (lbtn) {
                applyLang(lbtn.getAttribute('data-lang'), { persist: true });
                return;
            }
            const tbtn = findThemeButton(e.target);
            if (tbtn) {
                applyTheme(tbtn.getAttribute('data-theme'), { persist: true });
                return;
            }
        });
        applyLang(readStored(), { persist: false });
        applyTheme(detectTheme(), { persist: false });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', main);
    } else {
        main();
    }
})();
