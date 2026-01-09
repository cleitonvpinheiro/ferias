document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('formTaxas');
    const feedback = document.getElementById('feedback');
    const btnSubmit = document.getElementById('btnSubmit');
    const selectFuncionario = document.getElementById('select_funcionario');
    const draftIdInput = document.getElementById('taxa_id_draft');

    // --- Check for Signature Token ---
    const urlParams = new URLSearchParams(window.location.search);
    const signatureToken = urlParams.get('token');
    
    if (signatureToken) {
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
                        el.value = val || '';
                        el.disabled = true; // Disable inputs
                    }
                };
                
                fill('nome_taxa', data.nome_taxa);
                fill('cpf', data.cpf);
                fill('funcao', data.funcao);
                fill('departamento', data.departamento);
                fill('email_gestor', data.email_gestor);
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
            const res = await fetch('/api/funcionarios');
            const funcionarios = await res.json();
            
            selectFuncionario.innerHTML = '<option value="">Selecione um colaborador...</option>';
            funcionarios.forEach(f => {
                const opt = document.createElement('option');
                opt.value = f.id;
                opt.textContent = f.nome;
                opt.dataset.dados = JSON.stringify(f);
                selectFuncionario.appendChild(opt);
            });
        } catch (e) {
            console.error('Erro ao carregar funcionarios', e);
            selectFuncionario.innerHTML = '<option value="">Erro ao carregar lista</option>';
        }
    }
    loadFuncionarios();

    // --- Handle Selection ---
    selectFuncionario.addEventListener('change', () => {
        const opt = selectFuncionario.selectedOptions[0];
        
        // Se resetou para o valor vazio
        if (!opt || !opt.value) {
            document.getElementById('formTaxas').reset();
            // Reset dynamic fields
            const formaPagamento = document.getElementById('forma_pagamento');
            if(formaPagamento) {
                formaPagamento.dispatchEvent(new Event('change'));
            }
            return;
        }

        try {
            const dados = JSON.parse(opt.dataset.dados);
            console.log('Dados carregados:', dados);

            // Helper to fill and highlight
            const fill = (id, val) => {
                const el = document.getElementById(id);
                if (el) {
                    el.value = val || '';
                    // Visual feedback
                    el.style.backgroundColor = '#e0f2fe'; // light blue
                    setTimeout(() => el.style.backgroundColor = '', 1000);
                }
            };

            // Fill fields
            if(dados.nome) fill('nome_taxa', dados.nome);
            if(dados.cpf) fill('cpf', dados.cpf);
            if(dados.funcao) fill('funcao', dados.funcao);
            if(dados.departamento) fill('departamento', dados.departamento);
            
            // Banking
            const formaPagamento = document.getElementById('forma_pagamento');
            
            // Logic to pre-select banking info if available in dados
            if (dados.chave_pix) {
                formaPagamento.value = 'pix';
                formaPagamento.dispatchEvent(new Event('change'));
                fill('pix', dados.chave_pix);
            } else if (dados.banco) {
                formaPagamento.value = 'transferencia';
                formaPagamento.dispatchEvent(new Event('change'));
                fill('banco', dados.banco);
                fill('agencia', dados.agencia);
                fill('conta', dados.conta);
                if (dados.tipo_conta) {
                    const rad = document.querySelector(`input[name="tipo_conta"][value="${dados.tipo_conta}"]`);
                    if(rad) rad.checked = true;
                }
            }
            
            // Trigger auto-save immediately to start a draft
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

    const collectPayload = () => {
        const getVal = (id) => document.getElementById(id)?.value || '';
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
            cpf: getVal('cpf'),
            funcao: getVal('funcao'),
            forma_pagamento: formaPagamentoVal,
            banco: (formaPagamentoVal === 'transferencia') ? getVal('banco') : '',
            agencia: (formaPagamentoVal === 'transferencia') ? getVal('agencia') : '',
            conta: (formaPagamentoVal === 'transferencia') ? getVal('conta') : '',
            tipo_conta: (formaPagamentoVal === 'transferencia') ? document.querySelector('input[name="tipo_conta"]:checked')?.value : '',
            pix: (formaPagamentoVal === 'pix') ? getVal('pix') : '',
            departamento: getVal('departamento'),
            motivo: getChecked('motivo'),
            antecessor: getVal('antecessor'),
            valores: {
                taxa: {
                    valor: getVal('valor_taxa'),
                    qtd: getVal('qtd_taxa'),
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
            email_gestor: getVal('email_gestor'),
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
        });
    });

    // --- Toggle Payment Method Fields ---
    const formaPagamento = document.getElementById('forma_pagamento');
    const fieldsTransferencia = document.getElementById('fields-transferencia');
    const fieldsPix = document.getElementById('fields-pix');
    
    // Inputs inside the sections
    const inputsTransferencia = ['banco', 'agencia', 'conta'].map(id => document.getElementById(id));
    const inputPix = document.getElementById('pix');

    if (formaPagamento) {
        formaPagamento.addEventListener('change', () => {
            const val = formaPagamento.value;
            
            // Hide all first
            fieldsTransferencia.style.display = 'none';
            fieldsPix.style.display = 'none';
            
            // Remove required from all
            inputsTransferencia.forEach(el => { if(el) el.removeAttribute('required'); });
            if(inputPix) inputPix.removeAttribute('required');

            if (val === 'transferencia') {
                fieldsTransferencia.style.display = 'grid';
                inputsTransferencia.forEach(el => { if(el) el.setAttribute('required', 'required'); });
            } else if (val === 'pix') {
                fieldsPix.style.display = 'block';
                if(inputPix) inputPix.setAttribute('required', 'required');
            }
        });
    }

    // --- Calculations ---
    const inputsCalc = ['valor_taxa', 'qtd_taxa', 'valor_vt', 'qtd_vt'];
    inputsCalc.forEach(id => {
        document.getElementById(id).addEventListener('input', calculateTotals);
    });

    function calculateTotals() {
        const vTaxa = parseFloat(document.getElementById('valor_taxa').value) || 0;
        const qTaxa = parseFloat(document.getElementById('qtd_taxa').value) || 0;
        const tTaxa = vTaxa * qTaxa;
        document.getElementById('total_taxa').value = tTaxa.toFixed(2);

        const vVt = parseFloat(document.getElementById('valor_vt').value) || 0;
        const qVt = parseFloat(document.getElementById('qtd_vt').value) || 0;
        const tVt = vVt * qVt;
        document.getElementById('total_vt').value = tVt.toFixed(2);

        document.getElementById('total_geral').value = (tTaxa + tVt).toFixed(2);
    }

    // --- Dates UX ---
    const datesContainer = document.getElementById('datesContainer');
    const btnAddDate = document.getElementById('btnAddDate');

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

    btnAddDate.addEventListener('click', () => {
        const row = document.createElement('div');
        row.className = 'date-row';
        row.innerHTML = `
            <input type="date" class="input-date-worked">
            <select class="select-day-week">
                <option value="">Dia da Semana</option>
                <option value="segunda">Segunda-feira</option>
                <option value="terca">Terça-feira</option>
                <option value="quarta">Quarta-feira</option>
                <option value="quinta">Quinta-feira</option>
                <option value="sexta">Sexta-feira</option>
                <option value="sabado">Sábado</option>
                <option value="domingo">Domingo</option>
            </select>
        `;
        datesContainer.appendChild(row);
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
            ctx.scale(ratio, ratio);
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
        const context = canvas.getContext('2d');
        const pixelBuffer = new Uint32Array(
            context.getImageData(0, 0, canvas.width, canvas.height).data.buffer
        );
        return !pixelBuffer.some(color => color !== 0);
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

    // --- Submit Logic ---
    const submitForm = async (resetAfter = false) => {
        feedback.hidden = true;
        feedback.className = 'feedback';
        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Enviando...';
        if (btnEnviarNovo) btnEnviarNovo.disabled = true;

        const payload = collectPayload();
        
        // Basic Validation
        if (!payload.nome_taxa || !payload.motivo.length || !payload.email_gestor || !payload.email_solicitante) {
            feedback.textContent = 'Preencha os campos obrigatórios (Nome, Motivo, Emails).';
            feedback.className = 'feedback error';
            feedback.hidden = false;
            btnSubmit.disabled = false;
            btnSubmit.textContent = 'Enviar Solicitação';
            if (btnEnviarNovo) btnEnviarNovo.disabled = false;
            return;
        }

        if (signatureToken) {
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
                    window.location.href = '/';
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

        // Normal Mode: Skip Taxa Signature validation (collected later)
        /* 
        if (!payload.assinatura_taxa) {
             // Removed validation
        } 
        */

        if (!payload.assinatura_gestor) {
            feedback.textContent = 'A assinatura do Gestor é obrigatória.';
            feedback.className = 'feedback error';
            feedback.hidden = false;
            btnSubmit.disabled = false;
            btnSubmit.textContent = 'Enviar Solicitação';
            if (btnEnviarNovo) btnEnviarNovo.disabled = false;
            return;
        }

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
                        gestor: document.getElementById('email_gestor').value,
                        solicitante: document.getElementById('email_solicitante').value,
                        departamento: document.getElementById('departamento').value
                    };
                    
                    form.reset();
                    
                    // Restore common fields
                    document.getElementById('email_gestor').value = savedEmails.gestor;
                    document.getElementById('email_solicitante').value = savedEmails.solicitante;
                    document.getElementById('departamento').value = savedEmails.departamento;
                    
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
                    
                    // Reset date rows (default 4)
                    const datesContainer = document.getElementById('datesContainer');
                    const btnAddDate = document.getElementById('btnAddDate');
                    datesContainer.innerHTML = '';
                    for(let i=0; i<4; i++) {
                       if(btnAddDate) btnAddDate.click(); 
                    }
                    
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
                    // Keep one date row? Default is 4. Reset to 4.
                    const datesContainer = document.getElementById('datesContainer');
                    const btnAddDate = document.getElementById('btnAddDate');
                    datesContainer.innerHTML = ''; 
                    for(let i=0; i<4; i++) {
                       if(btnAddDate) btnAddDate.click(); 
                    }

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
