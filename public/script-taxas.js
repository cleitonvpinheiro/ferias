document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('formTaxas');
    const feedback = document.getElementById('feedback');
    const btnSubmit = document.getElementById('btnSubmit');

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

    // --- Submit ---
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        feedback.hidden = true;
        feedback.className = 'feedback';
        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Enviando...';

        // Collect Data
        const getVal = (id) => document.getElementById(id).value;
        const getChecked = (name) => Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map(cb => cb.value);

        // Dates
        const dates = [];
        document.querySelectorAll('.date-row').forEach(row => {
            const d = row.querySelector('.input-date-worked').value;
            const w = row.querySelector('.select-day-week').value;
            if (d || w) dates.push({ data: d, dia: w });
        });

        // Signatures
        const canvasTaxa = document.getElementById('assinaturaTaxa');
        const canvasGestor = document.getElementById('assinaturaGestor');

        if (isCanvasBlank(canvasTaxa)) {
            feedback.textContent = 'A assinatura do Taxa é obrigatória.';
            feedback.className = 'feedback error';
            feedback.hidden = false;
            btnSubmit.disabled = false;
            btnSubmit.textContent = 'Enviar Solicitação';
            return;
        }
        if (isCanvasBlank(canvasGestor)) {
            feedback.textContent = 'A assinatura do Gestor é obrigatória.';
            feedback.className = 'feedback error';
            feedback.hidden = false;
            btnSubmit.disabled = false;
            btnSubmit.textContent = 'Enviar Solicitação';
            return;
        }

        const formaPagamentoVal = getVal('forma_pagamento');
        const payload = {
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
            
            assinatura_taxa: canvasTaxa.toDataURL(),
            assinatura_gestor: canvasGestor.toDataURL()
        };

        try {
            const res = await fetch('/api/taxas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (res.ok) {
                feedback.textContent = 'Solicitação enviada com sucesso! O RH foi notificado.';
                feedback.className = 'feedback success';
                feedback.hidden = false;
                form.reset();
                // Clear canvases
                const ctxT = canvasTaxa.getContext('2d');
                ctxT.clearRect(0, 0, canvasTaxa.width, canvasTaxa.height);
                const ctxG = canvasGestor.getContext('2d');
                ctxG.clearRect(0, 0, canvasGestor.width, canvasGestor.height);
                
                // Reset dynamic fields
                antecessorArea.hidden = true;
                if(formaPagamento) {
                    formaPagamento.dispatchEvent(new Event('change'));
                }
                // Keep one date row? Default is 4. Reset to 4.
                datesContainer.innerHTML = ''; // Rebuild default 4 rows
                for(let i=0; i<4; i++) {
                   btnAddDate.click(); 
                }

            } else {
                throw new Error(data.message || 'Erro ao enviar.');
            }
        } catch (err) {
            feedback.textContent = err.message;
            feedback.className = 'feedback error';
            feedback.hidden = false;
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.textContent = 'Enviar Solicitação';
        }
    });
});
