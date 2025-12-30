const canvas = document.getElementById('assinatura');
const limparBtn = document.getElementById('limpar');
const form = document.getElementById('formFerias');
const feedback = document.getElementById('feedback');
const tipoGozoEl = document.getElementById('tipoGozo');
const periodoExtra = document.getElementById('periodoExtra');
const rhApprovalArea = document.getElementById('rhApprovalArea');
const areaSugestao = document.getElementById('areaSugestao');
const inicio2El = document.getElementById('inicio2');
const sugestaoDataEl = document.getElementById('sugestaoData');
const gestorEmailEl = document.getElementById('gestorEmail');
const justificativaRHEl = document.getElementById('justificativaRH');
const historicoContainer = document.getElementById('historicoContainer');
const historicoLista = document.getElementById('historicoLista');
const radiosStatus = document.querySelectorAll('input[name="statusRH"]');
const btnSubmit = document.getElementById('btnSubmit');

const urlParams = new URLSearchParams(window.location.search);
const modeRH = urlParams.get('mode') === 'rh';
const requestId = urlParams.get('id');

if (modeRH) {
    const backLink = document.querySelector('a[href="/"]');
    if (backLink) {
        backLink.href = '/dashboard-rh.html';
        backLink.innerHTML = '&larr; Voltar ao Painel RH';
    }
}

// Canvas RH REMOVED (Autentique)

function setupCanvas(cvs, ctxVar, isDrawingVar, isSignedVar, limparBtn) {
    const resize = () => {
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        const rect = cvs.getBoundingClientRect();
        cvs.width = rect.width * ratio;
        cvs.height = rect.height * ratio;
        const ctx = cvs.getContext('2d');
        ctx.scale(ratio, ratio);
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#111827';
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, rect.width, rect.height);
        return ctx;
    };
    
    let ctx = resize();
    window.addEventListener('resize', () => { ctx = resize(); });
    
    const pointerPos = (e) => {
        const rect = cvs.getBoundingClientRect();
        const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
        const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;
        return { x, y };
    };

    cvs.addEventListener('pointerdown', e => {
        isDrawingVar.val = true;
        isSignedVar.val = true;
        const { x, y } = pointerPos(e);
        ctx.beginPath();
        ctx.moveTo(x, y);
    });

    cvs.addEventListener('pointermove', e => {
        if (!isDrawingVar.val) return;
        const { x, y } = pointerPos(e);
        ctx.lineTo(x, y);
        ctx.stroke();
    });

    cvs.addEventListener('pointerup', () => { isDrawingVar.val = false; });
    cvs.addEventListener('pointerleave', () => { isDrawingVar.val = false; });
    
    limparBtn.addEventListener('click', () => {
        const rect = cvs.getBoundingClientRect();
        ctx.clearRect(0, 0, rect.width, rect.height);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, rect.width, rect.height);
        isSignedVar.val = false;
    });
    
    return { ctx, resize };
}

// RH Canvas Setup REMOVED (Autentique)

function renderHistorico(historico) {
    if (!historico || !historico.length) {
        if (historicoContainer) historicoContainer.hidden = true;
        return;
    }
    if (historicoContainer) historicoContainer.hidden = false;
    if (historicoLista) {
        historicoLista.innerHTML = '';
        historico.slice().reverse().forEach(item => { // Show newest first
            const li = document.createElement('li');
            li.style.cssText = 'padding: 12px; background: white; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 0.875rem; box-shadow: 0 1px 2px rgba(0,0,0,0.05);';
            
            const date = new Date(item.data).toLocaleString('pt-BR');
            const ator = item.ator === 'RH' ? '🔴 RH' : '🔵 Solicitante';
            const acaoMap = {
                'reprovado': 'Reprovou / Solicitou Ajuste',
                'aprovado': 'Aprovou',
                'reenvio': 'Reenviou solicitação',
                'pendente_rh': 'Criou solicitação'
            };
            const acao = acaoMap[item.acao] || item.acao;
            
            let html = `<div style="display:flex; justify-content:space-between; margin-bottom:6px; font-weight:600; align-items:center;">
                <span style="display:flex; align-items:center; gap:6px;">${ator} <span style="font-weight:400; color:#94a3b8;">&bull;</span> ${acao}</span>
                <span style="color:#64748b; font-size:0.75rem;">${date}</span>
            </div>`;
            
            if (item.justificativa) {
                html += `<div style="padding: 8px; background: #f1f5f9; border-radius: 4px; color: #334155; line-height: 1.5;">${item.justificativa}</div>`;
            }
            
            li.innerHTML = html;
            historicoLista.appendChild(li);
        });
    }
}

const populateInputs = (data) => {
    document.getElementById('nome').value = data.nome || '';
    document.getElementById('setor').value = data.setor || '';
    document.getElementById('inicio').value = data.inicio ? data.inicio.split('T')[0] : '';
    document.getElementById('tipoGozo').value = data.tipoGozo || '30';
    document.getElementById('decimo').value = data.decimo ? 'sim' : 'nao';
    if (data.gestorEmail) document.getElementById('gestorEmail').value = data.gestorEmail;
    document.getElementById('nomeGestor').value = data.nomeGestor || '';
    if (data.inicio2) {
        document.getElementById('inicio2').value = data.inicio2.split('T')[0];
        periodoExtra.hidden = false;
    }
    
    // Load Gestor Signature if exists - REMOVED (Autentique)
    
    renderHistorico(data.historico);

    tipoGozoEl.dispatchEvent(new Event('change'));
};

// Função para preencher e desabilitar campos (Modo RH)
const populateAndDisable = (data) => {
    populateInputs(data);
    
    // Desabilita campos
    ['nome', 'setor', 'inicio', 'tipoGozo', 'decimo', 'gestorEmail', 'inicio2', 'nomeGestor'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = true;
    });
    
    // Disable Gestor Canvas (se existisse)
    // canvasGestor.style.pointerEvents = 'none';
    // limparGestorBtn.hidden = true;

    // Lógica de Estado: Aguardando Assinatura
    if (data.status === 'aguardando_assinatura') {
        // Oculta área de aprovação do RH (já foi aprovado)
        rhApprovalArea.hidden = true;
        
        // Remove feedback anterior se houver para evitar duplicidade
        const existingStatus = document.getElementById('status-feedback-card');
        if (existingStatus) existingStatus.remove();

        // Exibe feedback visual de status
        const statusDiv = document.createElement('div');
        statusDiv.id = 'status-feedback-card';
        statusDiv.className = 'rh-approval-card';
        statusDiv.innerHTML = '<h3 class="rh-card-title" style="color: var(--success)">✅ Solicitação Aprovada pelo RH</h3><p>Por favor, colete a assinatura do colaborador abaixo.</p>';
        form.insertBefore(statusDiv, rhApprovalArea);

        // Habilita Assinatura (Remove overlay e permite interação)
        const overlay = document.getElementById('signatureOverlay');
        if (overlay) overlay.hidden = true;
        
        canvas.style.pointerEvents = 'auto'; // Habilita
        document.getElementById('limpar').hidden = false;
        
        btnSubmit.textContent = 'Assinar e Finalizar';
        btnSubmit.hidden = false;
        
        // Marca status como aprovado para o envio
        const inputApprove = document.querySelector('input[name="statusRH"][value="aprovado"]');
        if(inputApprove) inputApprove.checked = true;

    } else if (data.status === 'concluido') {
        rhApprovalArea.hidden = true;
        const existingStatus = document.getElementById('status-feedback-card');
        if (existingStatus) existingStatus.remove();

        const statusDiv = document.createElement('div');
        statusDiv.id = 'status-feedback-card';
        statusDiv.className = 'rh-approval-card';
        statusDiv.innerHTML = `
            <h3 class="rh-card-title" style="color: var(--success)">✅ Processo Concluído</h3>
            <p>Solicitação aprovada e assinada.</p>
            <a href="/api/pdf/${data.id}" target="_blank" class="enviar" style="display:block; text-align:center; text-decoration:none; margin-top:10px; background-color: #4b5563;">📄 Baixar PDF Assinado</a>
        `;
        form.insertBefore(statusDiv, rhApprovalArea);
        
        const overlay = document.getElementById('signatureOverlay');
        if (overlay) overlay.hidden = true;
        
        canvas.style.pointerEvents = 'none';
        document.getElementById('limpar').hidden = true;
        btnSubmit.hidden = true;
        
        // Load signature image
        if (data.assinatura) {
            const img = new Image();
            img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            img.src = data.assinatura;
            currentSignatureData = data.assinatura;
        }
    } else {
        // Remove feedback se voltar para estado anterior
        const existingStatus = document.getElementById('status-feedback-card');
        if (existingStatus) existingStatus.remove();

        // Estado normal ou inicial: Mantém overlay visível e bloqueia
        const overlay = document.getElementById('signatureOverlay');
        if (overlay) overlay.hidden = false;
        
        canvas.style.pointerEvents = 'none';
        document.getElementById('limpar').hidden = true;
        btnSubmit.hidden = false;
        
        // RH Signature Logic REMOVED (Autentique)
    }
};

if (requestId) {
    fetch(`/api/solicitacao/${requestId}`)
      .then(r => r.json())
      .then(data => {
          if (data.ok === false) {
              showFeedback('Solicitação não encontrada.');
              return;
          }
          if (modeRH) {
              populateAndDisable(data);
          } else {
              populateInputs(data);
          }
      })
      .catch(() => showFeedback('Erro ao carregar dados da solicitação.'));
}

if (modeRH) {
  rhApprovalArea.hidden = false;
  btnSubmit.textContent = 'Finalizar Validação';
  
  if (!requestId) {
    // Modo legado: Popula via URL Params
    const fields = ['nome', 'setor', 'inicio', 'tipoGozo', 'decimo', 'gestorEmail', 'inicio2'];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
        el.value = urlParams.get(id) || (id === 'decimo' ? (urlParams.get('decimo') === 'true' ? 'sim' : 'nao') : '');
        el.disabled = true; 
        }
    });
    if (isSplit(urlParams.get('tipoGozo'))) {
        periodoExtra.hidden = false;
    }
  }
  
  if (requestId) {
    // Se tem ID, o fetch cuidará da lógica do overlay dentro de populateAndDisable
  } else {
    // Se é nova solicitação (sem ID), garante que o overlay está visível e bloqueado
    const overlay = document.getElementById('signatureOverlay');
    if (overlay) overlay.hidden = false;
    canvas.style.pointerEvents = 'none';
    document.getElementById('limpar').hidden = true;
  }
}

let isDrawing = false;
let isSigned = false;
let ctx;
let currentSignatureData = null;

function resizeCanvas() {
  const ratio = Math.max(window.devicePixelRatio || 1, 1);
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * ratio;
  canvas.height = rect.height * ratio;
  ctx = canvas.getContext('2d');
  ctx.scale(ratio, ratio);
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#111827';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, rect.width, rect.height);
  
  if (currentSignatureData) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      img.src = currentSignatureData;
  }
}

function pointerPos(e) {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
  const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;
  return { x, y };
}

canvas.addEventListener('pointerdown', e => {
  isDrawing = true;
  isSigned = true;
  const { x, y } = pointerPos(e);
  ctx.beginPath();
  ctx.moveTo(x, y);
});

canvas.addEventListener('pointermove', e => {
  if (!isDrawing) return;
  const { x, y } = pointerPos(e);
  ctx.lineTo(x, y);
  ctx.stroke();
});

canvas.addEventListener('pointerup', () => {
  isDrawing = false;
});
canvas.addEventListener('pointerleave', () => {
  isDrawing = false;
});

limparBtn.addEventListener('click', () => {
  const rect = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, rect.width, rect.height);
  isSigned = false;
});

function showFeedback(msg) {
  feedback.textContent = msg;
  feedback.hidden = false;
}

form.addEventListener('submit', async e => {
  e.preventDefault();
  const nome = document.getElementById('nome').value.trim();
  const setor = document.getElementById('setor').value.trim();
  const inicio = document.getElementById('inicio').value;
  const tipoGozo = document.getElementById('tipoGozo').value;
  const decimo = document.getElementById('decimo').value === 'sim';
  const statusRH = document.querySelector('input[name="statusRH"]:checked').value;
  const sugestaoData = sugestaoDataEl.value;
  const inicio2 = inicio2El.value;
  const gestorEmail = gestorEmailEl.value.trim();

  if (!nome || !setor || !inicio || !tipoGozo) {
    showFeedback('Preencha todos os campos obrigatórios.');
    return;
  }
  if (isSplit(tipoGozo) && !inicio2) {
    showFeedback('Informe o início do segundo período.');
    return;
  }
  
  const endpoint = modeRH ? '/api/solicitacao' : '/api/encaminhar';
  
  const dataURL = isSigned ? canvas.toDataURL('image/png') : null;
  // rhDataURL REMOVED (Autentique)

  try {
    const nomeGestor = document.getElementById('nomeGestor').value.trim();
    const body = { nome, setor, inicio, inicio2: isSplit(tipoGozo) ? inicio2 : undefined, tipoGozo, decimo, gestorEmail: gestorEmail || undefined, nomeGestor: nomeGestor || undefined };
    if (requestId) body.id = requestId;
    
    // Add Gestor Signature to payload (always sent if present)
    // REMOVED: gestorDataURL variable is not defined because we removed the manual signature canvas logic
    // if (gestorDataURL) body.assinaturaGestor = gestorDataURL;
    
    if (modeRH) {
       body.statusRH = statusRH;
       body.sugestaoData = statusRH === 'reprovado' ? sugestaoData : undefined;
       body.justificativa = (statusRH === 'reprovado' && justificativaRHEl) ? justificativaRHEl.value : undefined;
       body.assinatura = dataURL;
       // body.assinaturaRH REMOVED (Autentique)
    }

    const r = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const j = await r.json();
    if (!j.ok) {
      showFeedback(j.erro || 'Falha ao enviar a solicitação.');
      return;
    }
    
    if (modeRH) {
        const link = j.autentique && j.autentique.link ? ` Link: ${j.autentique.link}` : '';
        showFeedback(`Validação concluída com sucesso.${link}`);
        
        // Aguarda 2 segundos e redireciona para o painel RH
        setTimeout(() => {
            window.location.href = '/protected/dashboard-rh.html';
        }, 2000);

        // Atualiza a interface para habilitar assinatura se necessário
        if (requestId) {
            fetch(`/api/solicitacao/${requestId}`)
              .then(r => r.json())
              .then(data => {
                  if (data.ok !== false) {
                      populateAndDisable(data);
                  }
              })
              .catch(console.error);
        }
    } else {
        showFeedback('Solicitação encaminhada ao RH com sucesso.');
    }

    if (!modeRH) {
       form.reset();
       limparBtn.click();
    }
  } catch (_) {
    showFeedback('Erro de comunicação com o servidor.');
  }
});

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function isSplit(gozo) {
  return gozo === '15+15';
}

tipoGozoEl.addEventListener('change', () => {
  const val = tipoGozoEl.value;
  const show = isSplit(val);
  periodoExtra.hidden = !show;
  if (!show) {
    inicio2El.value = '';
  }
});

radiosStatus.forEach(r => {
  r.addEventListener('change', () => {
    const isReprovado = r.value === 'reprovado';
    areaSugestao.hidden = !isReprovado;
    if (!isReprovado) sugestaoDataEl.value = '';
  });
});
