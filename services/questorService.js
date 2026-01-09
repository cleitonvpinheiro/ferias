const axios = require('axios');
const db = require('./db');
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

            return this.processFuncionarios(funcionariosQuestor);

        } catch (error) {
            console.error('Erro na integração Questor:', error.message);
            // Se falhar a conexão real, podemos retornar erro ou fallback
            throw new Error(`Falha na sincronização: ${error.message}`);
        }
    }

    /**
     * Processa e salva os dados no DB local
     */
    processFuncionarios(listaExterna) {
        const currentDb = db.funcionarios.read();
        let novos = 0;
        let atualizados = 0;

        listaExterna.forEach(externo => {
            // Mapeamento de campos (Questor -> Local)
            // Ajuste as chaves 'externo.xxx' conforme o JSON real da Questor
            const cargo = externo.cargo || externo.funcao;
            const setor = externo.setor || externo.departamento || externo.organograma;

            const funcionarioMapeado = {
                nome: externo.nome || externo.Nome,
                cpf: String(externo.cpf || externo.CPF || '').replace(/\D/g, ''),
                matricula: externo.matricula || externo.codigo,
                
                // Manter compatibilidade com diferentes partes do sistema (dashboard usa cargo/setor, forms usam funcao/departamento)
                cargo: cargo,
                funcao: cargo,
                setor: setor,
                departamento: setor,
                
                data_admissao: externo.data_admissao || externo.admissao,
                email: externo.email,
                // Mantém campos extras se existirem
                questor_id: externo.id || externo.codigo
            };

            // Validação mínima
            if (!funcionarioMapeado.nome || !funcionarioMapeado.cpf) return;

            const idx = currentDb.findIndex(local => local.cpf === funcionarioMapeado.cpf);
            
            if (idx >= 0) {
                // Atualiza mantendo ID local e outros campos não mapeados
                currentDb[idx] = { 
                    ...currentDb[idx], 
                    ...funcionarioMapeado, 
                    updatedAt: new Date().toISOString() 
                };
                atualizados++;
            } else {
                // Novo registro
                currentDb.push({
                    id: crypto.randomUUID(),
                    ...funcionarioMapeado,
                    createdAt: new Date().toISOString(),
                    origem: 'questor'
                });
                novos++;
            }
        });

        // Salva no disco
        db.funcionarios.write(currentDb);
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
