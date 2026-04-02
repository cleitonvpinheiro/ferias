const axios = require('axios');
const db = require('./db');
const { normalizeCpf, isValidCpf } = require('../utils/validation');
const crypto = require('crypto');

/**
 * Serviço de Integração com a API do Questor
 * 
 * Este serviço é responsável por conectar e sincronizar dados com o sistema Questor.
 * Configure as variáveis de ambiente no arquivo .env (ou hardcode aqui se preferir para testes):
 * 
 * QUESTOR_API_URL=https://api.questor.com.br/v2
 * QUESTOR_API_TOKEN=seu_token_aqui
 * 
 * Nota: A implementação abaixo é um template robusto. 
 * A URL exata e o formato de resposta dependem da versão da API Questor utilizada.
 */

class QuestorService {
    constructor() {
        this.baseUrl = process.env.QUESTOR_API_URL || 'https://api.questor.com.br/api/v2'; // Exemplo
        this.token = process.env.QUESTOR_API_TOKEN || ''; 
    }

    /**
     * Sincroniza funcionários da Questor para o banco de dados local
     */
    async syncFuncionarios() {
        console.log('Iniciando sincronização com Questor...');
        
        // Verifica se há configuração mínima (ou simula se não houver para não quebrar)
        if (!this.token && !process.env.NODE_ENV === 'production') {
            console.warn('QUESTOR_API_TOKEN não configurado. Retornando dados simulados.');
            return this.mockSync();
        }

        try {
            // Exemplo de chamada para listar funcionários
            // O endpoint '/funcionarios' é hipotético; ajuste conforme a documentação da Questor
            // Muitas vezes usa-se '/colaboradores' ou uma query SQL via API
            const response = await axios.get(`${this.baseUrl}/funcionarios`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                params: {
                    ativo: true, // Apenas ativos
                    // pagina: 1, // Paginação se necessário
                },
                timeout: 10000
            });

            const funcionariosQuestor = response.data.items || response.data; // Ajuste conforme resposta real

            if (!Array.isArray(funcionariosQuestor)) {
                throw new Error('Formato de resposta da API Questor inválido');
            }

            return await this.processFuncionarios(funcionariosQuestor);

        } catch (error) {
            console.error('Erro na integração Questor:', error.message);
            // Se falhar a conexão real, podemos retornar erro ou fallback
            throw new Error(`Falha na sincronização: ${error.message}`);
        }
    }

    /**
     * Processa e salva os dados no DB local
     */
    async processFuncionarios(listaExterna) {
        const currentDb = await db.funcionarios.getAll();
        const byCpf = new Map(
            currentDb
                .filter(f => f && f.cpf && isValidCpf(f.cpf))
                .map(f => [String(normalizeCpf(f.cpf)), f])
        );
        let novos = 0;
        let atualizados = 0;

        for (const externo of listaExterna) {
            // Mapeamento de campos (Questor -> Local)
            // Ajuste as chaves 'externo.xxx' conforme o JSON real da Questor
            const cargo = externo.cargo || externo.funcao;
            const setor = externo.setor || externo.departamento || externo.organograma;

            const funcionarioMapeado = {
                nome: externo.nome || externo.Nome,
                cpf: normalizeCpf(externo.cpf || externo.CPF || ''),
                matricula: externo.matricula || externo.codigo,
                
                // Manter compatibilidade com diferentes partes do sistema (dashboard usa cargo/setor, forms usam funcao/departamento)
                cargo: cargo,
                funcao: cargo,
                setor: setor,
                departamento: setor,
                
                data_admissao: externo.data_admissao || externo.admissao,
                nascimento: externo.nascimento || externo.data_nascimento || externo.dt_nascimento,
                sexo: externo.sexo || externo.genero || externo.gênero,
                raca_cor: externo.raca_cor || externo.raca || externo.raça || externo.cor,
                nacionalidade: externo.nacionalidade,
                tipo_vinculo: externo.tipo_vinculo || externo.vinculo || externo.regime,
                email: externo.email,
                // Mantém campos extras se existirem
                questor_id: externo.id || externo.codigo
            };

            // Validação mínima
            if (!funcionarioMapeado.nome || !funcionarioMapeado.cpf || !isValidCpf(funcionarioMapeado.cpf)) continue;

            const existing = byCpf.get(String(normalizeCpf(funcionarioMapeado.cpf)));
            if (existing) {
                await db.funcionarios.update(existing.id, { ...existing, ...funcionarioMapeado });
                atualizados++;
                continue;
            }

            await db.funcionarios.create({
                id: crypto.randomUUID(),
                ...funcionarioMapeado
            });
            novos++;
        }
        console.log(`Sincronização concluída. Novos: ${novos}, Atualizados: ${atualizados}`);
        
        return { ok: true, novos, atualizados };
    }

    /**
     * Simulação para testes quando não há credenciais
     */
    mockSync() {
        const mockData = [
            { Nome: 'João da Silva (Questor)', CPF: '11122233344', cargo: 'Analista', setor: 'TI', admissao: '2023-01-10' },
            { Nome: 'Maria Oliveira (Questor)', CPF: '55566677788', cargo: 'Gerente', setor: 'RH', admissao: '2022-05-20' }
        ];
        return this.processFuncionarios(mockData);
    }
}

module.exports = new QuestorService();
