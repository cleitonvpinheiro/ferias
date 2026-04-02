document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('formTaxas');
    const feedback = document.getElementById('feedback');
    const btnSubmit = document.getElementById('btnSubmit');
    const selectFuncionario = document.getElementById('select_funcionario');
    const draftIdInput = document.getElementById('taxa_id_draft');
    const dadosTaxaManualArea = document.getElementById('dadosTaxaManualArea');
    const inputNomeTaxa = document.getElementById('nome_taxa');
    const inputCpf = document.getElementById('cpf');
    const inputFuncao = document.getElementById('funcao');
    const inputDepartamento = document.getElementById('departamento');
    const inputYoucardCpf = document.getElementById('youcard_cpf');
    let currentUser = null;
    let allowedSetores = [];
    let funcionariosCache = [];
    let paymentUserEdited = false;
    let suppressPaymentTouch = false;

    const normalizeCpfDigits = (v) => (v || '').toString().replace(/\D/g, '').slice(0, 11);

    const formatCpf = (v) => {
        const d = normalizeCpfDigits(v);
        if (!d) return '';
        let out = d.slice(0, 3);
        if (d.length > 3) out += '.' + d.slice(3, 6);
        if (d.length > 6) out += '.' + d.slice(6, 9);
        if (d.length > 9) out += '-' + d.slice(9, 11);
        return out;
    };

    const isValidCpf = (cpf) => {
        const digits = normalizeCpfDigits(cpf);
        if (!digits || digits.length !== 11) return false;
        if (/^(\d)\1{10}$/.test(digits)) return false;
        const nums = digits.split('').map(n => Number(n));
        if (nums.some(n => Number.isNaN(n))) return false;
        let sum = 0;
        for (let i = 0; i < 9; i++) sum += nums[i] * (10 - i);
        let dv1 = (sum * 10) % 11;
        if (dv1 === 10) dv1 = 0;
        if (dv1 !== nums[9]) return false;
        sum = 0;
        for (let i = 0; i < 10; i++) sum += nums[i] * (11 - i);
        let dv2 = (sum * 10) % 11;
        if (dv2 === 10) dv2 = 0;
        return dv2 === nums[10];
    };

    if (dadosTaxaManualArea) dadosTaxaManualArea.hidden = true;
    if (inputNomeTaxa) inputNomeTaxa.readOnly = true;
    if (inputCpf) inputCpf.readOnly = true;
    if (inputFuncao) inputFuncao.disabled = true;
    if (inputDepartamento) inputDepartamento.disabled = true;
    if (inputYoucardCpf) inputYoucardCpf.value = '';

    if (inputCpf) {
        inputCpf.addEventListener('input', () => {
            const formatted = formatCpf(inputCpf.value);
            inputCpf.value = formatted;
        });
        inputCpf.value = formatCpf(inputCpf.value);
    }
    
    const loadMe = async () => {
        if (currentUser) return currentUser;
        try {
            const res = await fetch('/api/me', { headers: { 'Accept': 'application/json' } });
            if (!res.ok) throw new Error('Auth');
            const data = await res.json();
            currentUser = data && data.user ? data.user : null;
            return currentUser;
        } catch {
            currentUser = null;
            return null;
        }
    };
    
    const setDepartamentosOptions = (setores) => {
        if (!inputDepartamento) return;
        const list = Array.from(new Set((setores || []).map(s => String(s || '').trim()).filter(Boolean)))
            .sort((a, b) => a.localeCompare(b, 'pt-BR'));
        allowedSetores = list;
        
        inputDepartamento.innerHTML = '<option value="">Selecione...</option>' + list.map(s => `<option value="${s}">${s}</option>`).join('');
        
        const isGestor = currentUser && currentUser.role === 'gestor';
        if (isGestor && list.length === 1) {
            inputDepartamento.value = list[0];
            inputDepartamento.disabled = true;
        } else {
            inputDepartamento.disabled = false;
        }
    };
    
    const setFuncoesOptions = (funcoes) => {
        if (!inputFuncao) return;
        const list = Array.from(new Set((funcoes || []).map(s => String(s || '').trim()).filter(Boolean)))
            .sort((a, b) => a.localeCompare(b, 'pt-BR'));
        inputFuncao.innerHTML = '<option value="">Selecione...</option>' + list.map(s => `<option value="${s}">${s}</option>`).join('');
    };

    // --- Check for Signature Token ---
    const urlParams = new URLSearchParams(window.location.search);
    const signatureToken = urlParams.get('token');
    
    if (signatureToken) {
        if (dadosTaxaManualArea) dadosTaxaManualArea.hidden = false;
        const gestorCanvas = document.getElementById('assinaturaGestor');
        const gestorWrapper = gestorCanvas && gestorCanvas.closest ? gestorCanvas.closest('.signature-wrapper') : null;
        if (gestorWrapper) gestorWrapper.style.display = 'none';
        // Signature Mode - Force hide overlay immediately if possible
        const hideOverlay = () => {
            const overlay = document.getElementById('taxaSignatureOverlay');
            if (overlay) {
                overlay.hidden = true;
                overlay.style.display = 'none';
                overlay.style.setProperty('display', 'none', 'important');
            }
            const btnSubmit = document.getElementById('btnSubmit');
            if (btnSubmit) btnSubmit.textContent = 'Assinar e Finalizar';
            
            const btnNovo = document.getElementById('btnEnviarNovo');
            if (btnNovo) btnNovo.style.display = 'none';
        };
        
        // Attempt to hide immediately
        hideOverlay();
        // And on load to be sure
        window.addEventListener('load', hideOverlay);
        
        // Load data
        fetch(`/api/taxas/dados-assinatura?token=${signatureToken}`)
            .then(res => res.json())
            .then(data => {
                if (data.error) {
                    alert(data.error);
                    window.location.href = '/';
                    return;
                }
                
                // Ensure overlay is hidden again after any rendering
                hideOverlay();
                
                // Populate form (Read-only)
                const fill = (id, val) => {
                    const el = document.getElementById(id);
                    if (el) {
                        if (el.tagName === 'SELECT') {
                            const v = val || '';
                            const has = Array.from(el.options || []).some(o => o.value === v);
                            if (v && !has) {
                                const opt = document.createElement('option');
                                opt.value = v;
                                opt.textContent = v;
                                el.appendChild(opt);
                            }
                        }
                        el.value = id === 'cpf' ? formatCpf(val || '') : (val || '');
                        el.disabled = true; // Disable inputs
                    }
                };
                
                fill('nome_taxa', data.nome_taxa);
                fill('cpf', data.cpf);
                fill('funcao', data.funcao);
                fill('departamento', data.departamento);
                fill('aprovador_nome', data.aprovador_nome || 'Aprovação RH');
                fill('email_solicitante', data.email_solicitante);
                
                // Disable all other inputs
                document.querySelectorAll('input, select, button').forEach(el => {
                   if (el.id !== 'btnSubmit' && el.id !== 'assinaturaTaxa' && el.id !== 'limparTaxa') {
                       el.disabled = true;
                   }
                });
                
                // Scroll to signature and notify
                const canvas = document.getElementById('assinaturaTaxa');
                if (canvas) {
                    canvas.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    // Ensure canvas is interactable
                    canvas.style.pointerEvents = 'auto';
                }
                
                const feedback = document.getElementById('feedback');
                if (feedback) {
                    feedback.textContent = 'Assinatura liberada. Por favor, assine abaixo.';
                    feedback.className = 'feedback';
                    feedback.hidden = false;
                }
            })
            .catch(e => {
                console.error('Erro ao carregar dados para assinatura:', e);
                alert('Erro ao carregar solicitação.');
            });
    }

    // --- Load Funcionarios ---
    async function loadFuncionarios() {
        try {
            await loadMe();
            const isGestor = currentUser && currentUser.role === 'gestor';
            const url = isGestor ? '/api/gestor/equipe' : '/api/funcionarios';
            const res = await fetch(url);
            const funcionarios = await res.json();
            funcionariosCache = Array.isArray(funcionarios) ? funcionarios : [];
            
            selectFuncionario.innerHTML = '<option value="">Selecione um colaborador...</option><option value="__OUTRO__">Outro (não colaborador)</option>';
            funcionarios.forEach(f => {
                const opt = document.createElement('option');
                opt.value = f.id;
                opt.textContent = f.nome;
                opt.dataset.dados = JSON.stringify(f);
                selectFuncionario.appendChild(opt);
            });
            
            const setores = (funcionarios || [])
                .map(f => (f && (f.setor || f.departamento)) || '')
                .filter(Boolean);
            setDepartamentosOptions(setores);
            
            const funcoes = (funcionarios || [])
                .map(f => (f && (f.cargo || f.funcao)) || '')
                .filter(Boolean);
            setFuncoesOptions(funcoes);
        } catch (e) {
            console.error('Erro ao carregar funcionarios', e);
            selectFuncionario.innerHTML = '<option value="">Erro ao carregar lista</option>';
            if (inputDepartamento) {
                inputDepartamento.innerHTML = '<option value="">Erro ao carregar</option>';
                inputDepartamento.disabled = true;
            }
        }
    }
    loadFuncionarios();

    const getPaymentSnapshot = () => {
        const v = (id) => (document.getElementById(id)?.value || '').trim();
        return {
            forma: (document.getElementById('forma_pagamento')?.value || '').trim(),
            banco: v('banco'),
            agencia: v('agencia'),
            conta: v('conta'),
            pix: v('pix')
        };
    };

    const applyPaymentFromFuncionario = (func) => {
        if (!func) return;
        const formaPagamento = document.getElementById('forma_pagamento');
        suppressPaymentTouch = true;
        try {
            if (func.chave_pix) {
                if (formaPagamento) {
                    formaPagamento.value = 'pix';
                    formaPagamento.dispatchEvent(new Event('change'));
                }
                const pixEl = document.getElementById('pix');
                if (pixEl) pixEl.value = String(func.chave_pix || '');
            } else if (func.banco) {
                if (formaPagamento) {
                    formaPagamento.value = 'transferencia';
                    formaPagamento.dispatchEvent(new Event('change'));
                }
                const bancoEl = document.getElementById('banco');
                const agenciaEl = document.getElementById('agencia');
                const contaEl = document.getElementById('conta');
                if (bancoEl) bancoEl.value = String(func.banco || '');
                if (agenciaEl) agenciaEl.value = String(func.agencia || '');
                if (contaEl) contaEl.value = String(func.conta || '');
                if (func.tipo_conta) {
                    const rad = document.querySelector(`input[name="tipo_conta"][value="${func.tipo_conta}"]`);
                    if (rad) rad.checked = true;
                }
            }
        } finally {
            suppressPaymentTouch = false;
        }
    };

    // --- Handle Selection ---
    selectFuncionario.addEventListener('change', () => {
        const opt = selectFuncionario.selectedOptions[0];
        
        // Se resetou para o valor vazio
        if (!opt || !opt.value) {
            form.reset();
            const formaPagamento = document.getElementById('forma_pagamento');
            if (formaPagamento) formaPagamento.dispatchEvent(new Event('change'));
            if (dadosTaxaManualArea) dadosTaxaManualArea.hidden = true;
            if (inputNomeTaxa) { inputNomeTaxa.value = ''; inputNomeTaxa.readOnly = true; }
            if (inputCpf) { inputCpf.value = ''; inputCpf.readOnly = true; }
            if (inputFuncao) { inputFuncao.value = ''; inputFuncao.disabled = true; }
            if (inputDepartamento) {
                const isGestor = currentUser && currentUser.role === 'gestor';
                if (isGestor && allowedSetores.length === 1) inputDepartamento.value = allowedSetores[0];
                else inputDepartamento.value = '';
            }
            return;
        }

        try {
            const fill = (id, val) => {
                const el = document.getElementById(id);
                if (!el) return;
                if (el.tagName === 'SELECT') {
                    const v = val || '';
                    const has = Array.from(el.options || []).some(o => o.value === v);
                    if (v && !has) {
                        const opt = document.createElement('option');
                        opt.value = v;
                        opt.textContent = v;
                        el.appendChild(opt);
                    }
                }
                el.value = id === 'cpf' ? formatCpf(val || '') : (val || '');
                el.style.backgroundColor = '#e0f2fe';
                setTimeout(() => el.style.backgroundColor = '', 1000);
            };

            const clearBanking = () => {
                const formaPagamento = document.getElementById('forma_pagamento');
                if (formaPagamento) {
                    formaPagamento.value = '';
                    formaPagamento.dispatchEvent(new Event('change'));
                }
                fill('banco', '');
                fill('agencia', '');
                fill('conta', '');
                fill('pix', '');
                fill('youcard_cpf', '');
            };

            if (opt.value === '__OUTRO__') {
                if (dadosTaxaManualArea) dadosTaxaManualArea.hidden = false;
                if (inputNomeTaxa) { inputNomeTaxa.value = ''; inputNomeTaxa.readOnly = false; }
                if (inputCpf) { inputCpf.value = ''; inputCpf.readOnly = false; }
                if (inputFuncao) { inputFuncao.value = ''; inputFuncao.disabled = false; }
                if (inputDepartamento) {
                    const isGestor = currentUser && currentUser.role === 'gestor';
                    if (isGestor && allowedSetores.length === 1) {
                        inputDepartamento.value = allowedSetores[0];
                        inputDepartamento.disabled = true;
                    } else {
                        inputDepartamento.disabled = false;
                        inputDepartamento.value = '';
                    }
                }
                clearBanking();
                paymentUserEdited = false;
                if (inputNomeTaxa) setTimeout(() => inputNomeTaxa.focus(), 0);
                saveDraft();
                return;
            }

            const dados = JSON.parse(opt.dataset.dados || '{}');
            console.log('Dados carregados:', dados);

            if (dadosTaxaManualArea) dadosTaxaManualArea.hidden = true;
            if (inputNomeTaxa) inputNomeTaxa.readOnly = true;
            if (inputCpf) inputCpf.readOnly = true;
            if (inputFuncao) inputFuncao.disabled = true;

            fill('nome_taxa', dados.nome || '');
            fill('cpf', dados.cpf || '');
            fill('funcao', dados.cargo || dados.funcao || '');
            fill('departamento', dados.setor || dados.departamento || '');
            if (inputDepartamento) {
                const isGestor = currentUser && currentUser.role === 'gestor';
                inputDepartamento.disabled = isGestor && allowedSetores.length === 1;
            }

            clearBanking();

            applyPaymentFromFuncionario(dados);
            paymentUserEdited = false;

            syncAprovador();
            saveDraft();
            
        } catch (e) {
            console.error('Erro ao preencher dados:', e);
        }
    });

    // --- Auto-Save Draft Logic ---
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), wait);
        };
    }

    const normalizeName = (v) => {
        return String(v || '')
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[.]/g, '')
            .replace(/\s+/g, ' ');
    };

    const APROVADOR_POR_COLABORADOR = (() => {
        const m = new Map();
        const add = (aprovador, colaboradores) => {
            colaboradores.forEach(nome => m.set(normalizeName(nome), aprovador));
        };
        add('Anderson', ['Ricardo', 'Janete', 'Romário', 'Jamille']);
        add('Adriana', ['Marcelo C', 'Regina', 'Ergeton', 'Priscila']);
        add('Michelly', ['Andréa', 'Jadson', 'Wesley', 'Giovana']);
        add('Luciana', ['Gianna']);
        add('Leonardo', ['Marcelo B']);
        add('Jaqueline', ['Hebert', 'Taynna', 'Janaina', 'Juninho']);
        return m;
    })();

    const resolveAprovadorNome = (colaboradorNome) => {
        const norm = normalizeName(colaboradorNome);
        if (!norm) return '';
        const direct = APROVADOR_POR_COLABORADOR.get(norm);
        if (direct) return direct;
        const parts = norm.split(' ').filter(Boolean);
        const first = parts[0] || '';
        if (first) {
            const byFirst = APROVADOR_POR_COLABORADOR.get(first);
            if (byFirst) return byFirst;
        }
        if (parts.length >= 2) {
            const key = `${first} ${String(parts[1] || '').slice(0, 1)}`.trim();
            const byInitial = APROVADOR_POR_COLABORADOR.get(key);
            if (byInitial) return byInitial;
        }
        return '';
    };

    const syncAprovador = () => {
        const nome = document.getElementById('nome_taxa')?.value || '';
        const aprovador = resolveAprovadorNome(nome);
        const input = document.getElementById('aprovador_nome');
        if (!input) return;
        input.value = aprovador || 'Aprovação RH';
    };

    const collectPayload = () => {
        const getVal = (id) => document.getElementById(id)?.value || '';
        const normCpf = (v) => normalizeCpfDigits(v);
        const getChecked = (name) => Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map(cb => cb.value);

        // Dates
        const dates = [];
        document.querySelectorAll('.date-row').forEach(row => {
            const d = row.querySelector('.input-date-worked').value;
            const w = row.querySelector('.select-day-week').value;
            if (d || w) dates.push({ data: d, dia: w });
        });

        const formaPagamentoVal = getVal('forma_pagamento');
        
        // Signatures (only if not blank, to avoid huge empty payloads in draft if not signed)
        const canvasTaxa = document.getElementById('assinaturaTaxa');
        const canvasGestor = document.getElementById('assinaturaGestor');
        // Use null for submit validation checks, but empty string is fine for drafts.
        // Let's use logic that satisfies both or check later.
        // Original logic used empty string for drafts.
        const sigTaxa = !isCanvasBlank(canvasTaxa) ? canvasTaxa.toDataURL() : null;
        const sigGestor = !isCanvasBlank(canvasGestor) ? canvasGestor.toDataURL() : null;

        return {
            id: draftIdInput.value || undefined, // Send ID if exists
            nome_taxa: getVal('nome_taxa'),
            cpf: normCpf(getVal('cpf')),
            funcao: getVal('funcao'),
            forma_pagamento: formaPagamentoVal,
            banco: (formaPagamentoVal === 'transferencia') ? getVal('banco') : '',
            agencia: (formaPagamentoVal === 'transferencia') ? getVal('agencia') : '',
            conta: (formaPagamentoVal === 'transferencia') ? getVal('conta') : '',
            tipo_conta: (formaPagamentoVal === 'transferencia') ? document.querySelector('input[name="tipo_conta"]:checked')?.value : '',
            pix: (formaPagamentoVal === 'pix') ? getVal('pix') : (formaPagamentoVal === 'youcard' ? normCpf(getVal('cpf')) : ''),
            departamento: getVal('departamento'),
            motivo: getChecked('motivo'),
            detalhe_motivo: getVal('nome_evento'), // Novo campo
            antecessor: getVal('antecessor'),
            valores: {
                taxa: {
                    valor: getVal('valor_taxa'),
                    qtd: '',
                    total: getVal('total_taxa')
                },
                vt: {
                    valor: getVal('valor_vt'),
                    qtd: getVal('qtd_vt'),
                    total: getVal('total_vt')
                },
                total_geral: getVal('total_geral')
            },
            dias_trabalhados: dates,
            aprovador_nome: getVal('aprovador_nome'),
            email_solicitante: getVal('email_solicitante'),
            assinatura_taxa: sigTaxa,
            assinatura_gestor: sigGestor
        };
    };

    const saveDraft = debounce(async () => {
        const payload = collectPayload();
        // Only save if at least name is present (avoid saving empty drafts on initial load if triggered)
        if (!payload.nome_taxa) return;

        try {
            const res = await fetch('/api/taxas/draft', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.ok && data.id) {
                draftIdInput.value = data.id;
                console.log('Rascunho salvo:', data.id);
            }
        } catch (e) {
            console.warn('Erro no auto-save:', e);
        }
    }, 2000);

    // Attach auto-save to all inputs
    form.addEventListener('input', (e) => {
        // Skip hidden inputs or if submit was clicked
        if (e.target.type === 'hidden') return;
        saveDraft();
    });

    // --- Toggle Vaga Aberta Input ---
    const checkVagaAberta = document.getElementById('checkVagaAberta');
    const antecessorArea = document.getElementById('antecessorArea');
    const eventoArea = document.getElementById('eventoArea');
    
    // Listen to all checkboxes named "motivo"
    const motivos = document.querySelectorAll('input[name="motivo"]');
    motivos.forEach(cb => {
        cb.addEventListener('change', () => {
            if (cb.value === 'vaga_aberta') {
                antecessorArea.hidden = !cb.checked;
                const input = document.getElementById('antecessor');
                if (cb.checked) input.setAttribute('required', 'required');
                else input.removeAttribute('required');
            }
            if (cb.value === 'evento') {
                eventoArea.hidden = !cb.checked;
                const input = document.getElementById('nome_evento');
                if (cb.checked) input.setAttribute('required', 'required');
                else input.removeAttribute('required');
            }
        });
    });

    // --- Toggle Payment Method Fields ---
    const formaPagamento = document.getElementById('forma_pagamento');
    const fieldsTransferencia = document.getElementById('fields-transferencia');
    const fieldsPix = document.getElementById('fields-pix');
    const fieldsYoucard = document.getElementById('fields-youcard');
    
    // Inputs inside the sections
    const inputsTransferencia = ['banco', 'agencia', 'conta'].map(id => document.getElementById(id));
    const inputPix = document.getElementById('pix');
    const inputYoucardCpfLocal = document.getElementById('youcard_cpf');
    const syncYoucardCpf = () => {
        const v = document.getElementById('forma_pagamento')?.value;
        if (v !== 'youcard') return;
        const cpfVal = document.getElementById('cpf')?.value || '';
        if (inputYoucardCpfLocal) inputYoucardCpfLocal.value = cpfVal;
    };

    if (formaPagamento) {
        formaPagamento.addEventListener('change', () => {
            if (!suppressPaymentTouch) paymentUserEdited = true;
            const val = formaPagamento.value;
            
            // Hide all first
            fieldsTransferencia.style.display = 'none';
            fieldsPix.style.display = 'none';
            if (fieldsYoucard) fieldsYoucard.style.display = 'none';
            
            // Remove required from all
            inputsTransferencia.forEach(el => { if(el) el.removeAttribute('required'); });
            if(inputPix) inputPix.removeAttribute('required');

            if (val === 'transferencia') {
                fieldsTransferencia.style.display = 'grid';
                inputsTransferencia.forEach(el => { if(el) el.setAttribute('required', 'required'); });
            } else if (val === 'pix') {
                fieldsPix.style.display = 'block';
                if(inputPix) inputPix.setAttribute('required', 'required');
            } else if (val === 'youcard') {
                if (fieldsYoucard) fieldsYoucard.style.display = 'block';
                syncYoucardCpf();
            }
        });
    }
    if (inputCpf) inputCpf.addEventListener('input', syncYoucardCpf);
    ['banco', 'agencia', 'conta', 'pix'].forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('input', () => {
            if (!suppressPaymentTouch) paymentUserEdited = true;
        });
    });

    const tryAutofillPaymentByCpf = () => {
        if (!inputCpf) return;
        if (signatureToken) return;
        if (selectFuncionario.value !== '__OUTRO__') return;
        if (paymentUserEdited) return;
        const cpfDigits = normalizeCpfDigits(inputCpf.value);
        if (!cpfDigits || cpfDigits.length !== 11 || !isValidCpf(cpfDigits)) return;

        const snap = getPaymentSnapshot();
        const hasSomePayment = Boolean(snap.forma || snap.banco || snap.agencia || snap.conta || snap.pix);
        if (hasSomePayment) return;

        const found = (funcionariosCache || []).find(f => normalizeCpfDigits(f && f.cpf) === cpfDigits);
        if (!found) return;
        applyPaymentFromFuncionario(found);
    };

    if (inputCpf) {
        inputCpf.addEventListener('blur', tryAutofillPaymentByCpf);
        inputCpf.addEventListener('change', tryAutofillPaymentByCpf);
    }

    // --- Calculations ---
    const inputsCalc = ['valor_taxa', 'valor_vt', 'qtd_vt'];
    inputsCalc.forEach(id => {
        document.getElementById(id).addEventListener('input', calculateTotals);
    });

    function calculateTotals() {
        const vTaxa = parseFloat(document.getElementById('valor_taxa').value) || 0;
        const tTaxa = vTaxa;
        document.getElementById('total_taxa').value = tTaxa.toFixed(2);

        const vVt = parseFloat(document.getElementById('valor_vt').value) || 0;
        const qVt = parseFloat(document.getElementById('qtd_vt').value) || 0;
        const tVt = vVt * qVt;
        document.getElementById('total_vt').value = tVt.toFixed(2);

        document.getElementById('total_geral').value = (tTaxa + tVt).toFixed(2);
    }

    // --- Dates UX ---
    const datesContainer = document.getElementById('datesContainer');

    // Auto-fill day of week
    datesContainer.addEventListener('change', (e) => {
        if (e.target.classList.contains('input-date-worked')) {
            const dateVal = e.target.value;
            if (dateVal) {
                // Create date object (fix timezone issue by appending T12:00:00)
                const date = new Date(dateVal + 'T12:00:00');
                const dayWeek = date.toLocaleDateString('pt-BR', { weekday: 'long' })
                    .toLowerCase()
                    .replace('-feira', '')
                    .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // remove accents for value matching (terça -> terca)
                
                // Map pt-BR weekday to select values
                const map = {
                    'segunda': 'segunda',
                    'terca': 'terca',
                    'quarta': 'quarta',
                    'quinta': 'quinta',
                    'sexta': 'sexta',
                    'sabado': 'sabado',
                    'domingo': 'domingo'
                };
                
                // Simple mapping attempt
                let key = dayWeek.split(' ')[0]; // Handle "segunda-feira" -> "segunda"
                if (key === 'terca') key = 'terca'; // already normalized
                
                const select = e.target.nextElementSibling;
                if (map[key]) {
                    select.value = map[key];
                }
            }
        }
    });

    // --- Signatures ---
    setupSignature('assinaturaTaxa', 'limparTaxa');
    setupSignature('assinaturaGestor', 'limparGestor');

    function setupSignature(canvasId, clearBtnId) {
        const canvas = document.getElementById(canvasId);
        const ctx = canvas.getContext('2d');
        let isDrawing = false;

        function resizeCanvas() {
            const ratio = Math.max(window.devicePixelRatio || 1, 1);
            canvas.width = canvas.offsetWidth * ratio;
            canvas.height = canvas.offsetHeight * ratio;
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(ratio, ratio);
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = '#0f172a';
        }
        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();

        function getPos(e) {
            const rect = canvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return {
                x: clientX - rect.left,
                y: clientY - rect.top
            };
        }

        ['mousedown', 'touchstart'].forEach(ev => {
            canvas.addEventListener(ev, (e) => {
                isDrawing = true;
                const pos = getPos(e);
                ctx.beginPath();
                ctx.moveTo(pos.x, pos.y);
                e.preventDefault();
            }, { passive: false });
        });

        ['mousemove', 'touchmove'].forEach(ev => {
            canvas.addEventListener(ev, (e) => {
                if (!isDrawing) return;
                const pos = getPos(e);
                ctx.lineTo(pos.x, pos.y);
                ctx.stroke();
                e.preventDefault();
            }, { passive: false });
        });

        ['mouseup', 'touchend', 'mouseout'].forEach(ev => {
            canvas.addEventListener(ev, () => {
                isDrawing = false;
            });
        });

        document.getElementById(clearBtnId).addEventListener('click', () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        });
    }

    function isCanvasBlank(canvas) {
        if (!canvas) return true;
        if (!canvas.width || !canvas.height) return true;
        const context = canvas.getContext('2d');
        try {
            const pixelBuffer = new Uint32Array(
                context.getImageData(0, 0, canvas.width, canvas.height).data.buffer
            );
            return !pixelBuffer.some(color => color !== 0);
        } catch {
            return true;
        }
    }

    // --- Motive Selection Watcher ---
    const motiveCheckboxes = document.querySelectorAll('input[name="motivo"]');
    const btnEnviarNovo = document.getElementById('btnEnviarNovo');
    
    function checkMotives() {
        const selected = Array.from(motiveCheckboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value);
        const special = ['aumento_demanda', 'vaga_aberta'];
        const hasSpecial = selected.some(m => special.includes(m));
        
        if (hasSpecial) {
            btnEnviarNovo.style.display = 'inline-block';
        } else {
            btnEnviarNovo.style.display = 'none';
        }
    }
    
    motiveCheckboxes.forEach(cb => cb.addEventListener('change', checkMotives));
    document.getElementById('nome_taxa')?.addEventListener('input', syncAprovador);
    syncAprovador();

    // --- Submit Logic ---
    const submitForm = async (resetAfter = false) => {
        feedback.hidden = true;
        feedback.className = 'feedback';
        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Enviando...';
        if (btnEnviarNovo) btnEnviarNovo.disabled = true;

        const payload = collectPayload();

        if (signatureToken) {
            // Signature mode: only require the assinatura_taxa and send token to backend
            if (!payload.assinatura_taxa) {
                feedback.textContent = 'A assinatura é obrigatória.';
                feedback.className = 'feedback error';
                feedback.hidden = false;
                btnSubmit.disabled = false;
                btnSubmit.textContent = 'Assinar e Finalizar';
                return;
            }
            
            try {
                const res = await fetch('/api/taxas/assinar', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: signatureToken, assinatura: payload.assinatura_taxa })
                });
                const data = await res.json();
                if (res.ok) {
                    alert('Assinado com sucesso!');
                    if (data && data.pdf) {
                        const a = document.createElement('a');
                        a.href = data.pdf;
                        a.download = data.filename || 'taxa-assinada.pdf';
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                    }
                    try {
                        const u = new URL(window.location.href);
                        u.searchParams.delete('token');
                        window.history.replaceState({}, document.title, u.pathname + u.search);
                    } catch (_) {}
                    feedback.textContent = 'Assinatura concluída. Você já pode fechar esta janela.';
                    feedback.className = 'feedback success';
                    feedback.hidden = false;
                    btnSubmit.disabled = true;
                    btnSubmit.textContent = 'Assinado';
                } else {
                    throw new Error(data.error || 'Erro ao assinar');
                }
            } catch (e) {
                feedback.textContent = e.message;
                feedback.className = 'feedback error';
                feedback.hidden = false;
                btnSubmit.disabled = false;
                btnSubmit.textContent = 'Assinar e Finalizar';
            }
            return;
        }

        // Basic Validation (apenas no modo normal)
        if (!selectFuncionario.value) {
            feedback.textContent = 'Selecione um colaborador ou a opção "Outro".';
            feedback.className = 'feedback error';
            feedback.hidden = false;
            btnSubmit.disabled = false;
            btnSubmit.textContent = 'Enviar Solicitação';
            if (btnEnviarNovo) btnEnviarNovo.disabled = false;
            return;
        }

        if (!payload.nome_taxa || !payload.motivo.length || !payload.email_solicitante) {
            feedback.textContent = 'Preencha os campos obrigatórios (Nome, Motivo, E-mail).';
            feedback.className = 'feedback error';
            feedback.hidden = false;
            btnSubmit.disabled = false;
            btnSubmit.textContent = 'Enviar Solicitação';
            if (btnEnviarNovo) btnEnviarNovo.disabled = false;
            return;
        }

        if (!payload.cpf || payload.cpf.length !== 11 || !isValidCpf(payload.cpf)) {
            feedback.textContent = 'Informe um CPF válido.';
            feedback.className = 'feedback error';
            feedback.hidden = false;
            btnSubmit.disabled = false;
            btnSubmit.textContent = 'Enviar Solicitação';
            if (btnEnviarNovo) btnEnviarNovo.disabled = false;
            return;
        }

        // Normal Mode: Skip Taxa Signature validation (collected later)
        /* 
        if (!payload.assinatura_taxa) {
             // Removed validation
        } 
        */

        // Assinatura do gestor não é obrigatória: aprovação será feita no portal conforme responsável

        try {
            const res = await fetch('/api/taxas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (res.ok) {
                feedback.textContent = data.message;
                feedback.className = 'feedback success';
                feedback.hidden = false;
                
                // Clear draft
                localStorage.removeItem('form_taxas_draft');

                if (resetAfter) {
                    // Reset form but keep some fields like Manager Email/Requester Email/Department if desired
                    const savedEmails = {
                        solicitante: document.getElementById('email_solicitante').value
                    };
                    
                    form.reset();
                    
                    // Restore common fields
                    document.getElementById('email_solicitante').value = savedEmails.solicitante;
                    syncAprovador();
                    
                    // Clear signatures
                    const canvasTaxa = document.getElementById('assinaturaTaxa');
                    const canvasGestor = document.getElementById('assinaturaGestor');
                    const ctxT = canvasTaxa.getContext('2d');
                    ctxT.clearRect(0, 0, canvasTaxa.width, canvasTaxa.height);
                    const ctxG = canvasGestor.getContext('2d');
                    ctxG.clearRect(0, 0, canvasGestor.width, canvasGestor.height);
                    
                    // Reset dynamic fields
                    const antecessorArea = document.getElementById('antecessorArea');
                    if(antecessorArea) antecessorArea.hidden = true;
                    
                    const formaPagamento = document.getElementById('forma_pagamento');
                    if(formaPagamento) {
                        formaPagamento.dispatchEvent(new Event('change'));
                    }
                    
                    const firstDate = document.querySelector('#datesContainer .input-date-worked');
                    const firstDay = document.querySelector('#datesContainer .select-day-week');
                    if (firstDate) firstDate.value = '';
                    if (firstDay) firstDay.value = '';
                    
                    // Reset Checkbox display
                    checkMotives();
                    
                    // Reload funcionarios list
                    if(typeof loadFuncionarios === 'function') loadFuncionarios();

                    setTimeout(() => {
                        feedback.hidden = true;
                    }, 3000);

                } else {
                    form.reset();
                    // Clear canvases
                    const canvasTaxa = document.getElementById('assinaturaTaxa');
                    const canvasGestor = document.getElementById('assinaturaGestor');
                    const ctxT = canvasTaxa.getContext('2d');
                    ctxT.clearRect(0, 0, canvasTaxa.width, canvasTaxa.height);
                    const ctxG = canvasGestor.getContext('2d');
                    ctxG.clearRect(0, 0, canvasGestor.width, canvasGestor.height);
                    
                    // Reset dynamic fields
                    const antecessorArea = document.getElementById('antecessorArea');
                    if(antecessorArea) antecessorArea.hidden = true;
                    const formaPagamento = document.getElementById('forma_pagamento');
                    if(formaPagamento) {
                        formaPagamento.dispatchEvent(new Event('change'));
                    }
                    const firstDate = document.querySelector('#datesContainer .input-date-worked');
                    const firstDay = document.querySelector('#datesContainer .select-day-week');
                    if (firstDate) firstDate.value = '';
                    if (firstDay) firstDay.value = '';

                    // Reload funcionarios list
                    if(typeof loadFuncionarios === 'function') loadFuncionarios();
                }

            } else {
                throw new Error(data.message || 'Erro ao enviar.');
            }
        } catch (e) {
            feedback.textContent = e.message;
            feedback.className = 'feedback error';
            feedback.hidden = false;
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.textContent = 'Enviar Solicitação';
            if (btnEnviarNovo) btnEnviarNovo.disabled = false;
        }
    };

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        submitForm(false);
    });

    if (btnEnviarNovo) {
        btnEnviarNovo.addEventListener('click', (e) => {
            e.preventDefault();
            submitForm(true);
        });
    }

    // Initialize state
    checkMotives();
});
