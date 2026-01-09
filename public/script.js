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
const signatureToken = urlParams.get('token');

if (signatureToken) {
    // Signature Mode Logic
    // Unlock signature, disable everything else
    
    // Robust Hide Overlay Function
    const hideOverlay = () => {
        const overlay = document.getElementById('signatureOverlay');
        if (overlay) {
            overlay.hidden = true;
            overlay.style.display = 'none';
            overlay.style.setProperty('display', 'none', 'important');
        }
        const btnSubmit = document.getElementById('btnSubmit');
        if (btnSubmit) btnSubmit.textContent = 'Assinar e Finalizar';
    };

    // Trigger immediately
    hideOverlay();
    // Trigger on load to ensure it overrides any CSS or other scripts
    window.addEventListener('load', hideOverlay);

    
    // Change button text
    if (btnSubmit) btnSubmit.textContent = 'Assinar e Finalizar';
    
    // Load data
    fetch(`/api/solicitacao/token/${signatureToken}`)
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                alert(data.error);
                window.location.href = '/';
                return;
            }
            fillForm(data);
            disableFormInputs();
            hideOverlay(); // Ensure overlay is hidden after form population
            
            // Scroll to signature and notify
            if (canvas) {
                canvas.scrollIntoView({ behavior: 'smooth', block: 'center' });
                canvas.style.pointerEvents = 'auto';
            }
            showFeedback('Assinatura liberada. Por favor, assine abaixo.', false);
        })
        .catch(e => {
            console.error('Erro ao carregar solicitação', e);
            alert('Erro ao carregar dados da solicitação.');
        });
} else if (modeRH) {
    const backLink = document.querySelector('a[href="/"]');
    if (backLink) {
        backLink.href = '/protected/dashboard-rh.html';
        backLink.innerHTML = '&larr; Voltar ao Painel RH';
    }
}

function disableFormInputs() {
    const inputs = document.querySelectorAll('input, select, textarea');
    inputs.forEach(el => {
        if (el.id !== 'btnSubmit') { // Keep submit active
             el.disabled = true;
        }
    });
    // Ensure signature buttons are active
    if (limparBtn) limparBtn.disabled = false;
    if (canvas) canvas.style.pointerEvents = 'auto';
}

function fillForm(data) {
    // Helper to set values
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val || '';
    };
    
    setVal('nome', data.nome);
    setVal('setor', data.setor);
    setVal('inicio', data.inicio);
    setVal('decimo', data.decimo);
    setVal('gestorEmail', data.gestorEmail);
    setVal('nomeGestor', data.nomeGestor);
    
    if (tipoGozoEl) {
        tipoGozoEl.value = data.tipoGozo;
        tipoGozoEl.dispatchEvent(new Event('change'));
    }
    if (data.inicio2) setVal('inicio2', data.inicio2);
}

// Ensure overlay is present for normal mode
if (!signatureToken && !modeRH && !requestId) {
    // New request: signature is locked
    // Ensure overlay is visible (it is by default in HTML, but check logic)
} else if (modeRH) {
    // RH Mode: Signature is readonly anyway or hidden?
    // Usually RH sees the signature if it was there, but now it won't be there.
}

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

function renderHistorico(historico) {
    if (!historico || !historico.length) {
        if (historicoContainer) historicoContainer.hidden = true;
        return;
    }
    if (historicoContainer) historicoContainer.hidden = false;
    if (historicoLista) {
        historicoLista.innerHTML = '';
        historico.slice().reverse().forEach(item => {
            const li = document.createElement('li');
            li.style.cssText = 'padding: 12px; background: white; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 0.875rem; box-shadow: 0 1px 2px rgba(0,0,0,0.05);';
            
            const date = new Date(item.data).toLocaleString('pt-BR');
            const statusMap = {
                'pendente_rh': 'Aguardando RH',
                'aprovado': 'Aprovado',
                'reprovado': 'Reprovado',
                'pendente_assinatura': 'Aguardando Assinatura'
            };
            const statusLabel = statusMap[item.status] || item.status;
            
            li.innerHTML = `
                <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <strong style="color:#1e293b">${statusLabel}</strong>
                    <span style="color:#64748b; font-size:0.75rem">${date}</span>
                </div>
                ${item.obs ? `<div style="color:#475569; margin-top:4px;">${item.obs}</div>` : ''}
                ${item.usuario ? `<div style="color:#94a3b8; font-size:0.75rem; margin-top:4px;">Por: ${item.usuario}</div>` : ''}
            `;
            historicoLista.appendChild(li);
        });
    }
}

function showFeedback(msg, isError = true) {
    feedback.textContent = msg;
    feedback.hidden = false;
    feedback.style.color = isError ? '#dc2626' : '#16a34a';
    feedback.style.backgroundColor = isError ? '#fef2f2' : '#f0fdf4';
    feedback.style.borderColor = isError ? '#fecaca' : '#bbf7d0';
}

// Assinatura Colaborador
let isDrawing = { val: false };
let isSigned = { val: false };
let resizeCanvas = () => {};

if (canvas) {
    const setup = setupCanvas(canvas, null, isDrawing, isSigned, limparBtn);
    resizeCanvas = setup.resize;
}

// Populate (Modo RH)
function populateAndDisable(data) {
    document.getElementById('nome').value = data.nome;
    document.getElementById('setor').value = data.setor;
    document.getElementById('inicio').value = data.inicio;
    tipoGozoEl.value = data.tipoGozo;
    tipoGozoEl.dispatchEvent(new Event('change'));
    
    if (data.inicio2) {
        inicio2El.value = data.inicio2;
    }
    
    document.getElementById('decimo').value = data.decimo;
    if (data.gestorEmail) gestorEmailEl.value = data.gestorEmail;
    if (data.nomeGestor) document.getElementById('nomeGestor').value = data.nomeGestor;

    // Disable all inputs
    const inputs = form.querySelectorAll('input, select, button:not(#btnSubmit)');
    inputs.forEach(el => el.disabled = true);
    
    // Show signature if exists
    if (data.assinatura) {
        const img = new Image();
        img.src = data.assinatura;
        img.onload = () => {
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
    }
    
    // Setup RH area
    if (modeRH && rhApprovalArea) {
        rhApprovalArea.hidden = false;
        btnSubmit.textContent = 'Confirmar Avaliação RH';
        // Enable RH inputs
        radiosStatus.forEach(r => r.disabled = false);
        if (sugestaoDataEl) sugestaoDataEl.disabled = false;
        if (justificativaRHEl) justificativaRHEl.disabled = false;
        
        // Show History
        renderHistorico(data.historico);
    }
}

// Load Data if Edit/View Mode
if (requestId) {
    fetch(`/api/solicitacao/${requestId}`)
        .then(r => r.json())
        .then(data => {
            if (data.ok === false) {
                showFeedback(data.erro);
            } else {
                populateAndDisable(data);
                
                // If in signature mode, ensure overlay stays hidden after population
                if (signatureToken) {
                    const overlay = document.getElementById('signatureOverlay');
                    if (overlay) {
                        overlay.hidden = true;
                        overlay.style.display = 'none';
                        overlay.style.setProperty('display', 'none', 'important');
                    }
                }
            }
        })
        .catch(e => showFeedback('Erro ao carregar solicitação.'));
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  feedback.hidden = true;
  
  if (signatureToken) {
        if (!isSigned.val) {
            showFeedback('A assinatura é obrigatória para finalizar.');
            return;
        }
        
        try {
            const dataURL = canvas.toDataURL('image/png');
            const r = await fetch('/api/solicitacao/assinar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: signatureToken, assinatura: dataURL })
            });
            const j = await r.json();
            if (j.ok) {
                showFeedback('Assinado com sucesso! O processo foi finalizado.', false);
                setTimeout(() => window.location.href = '/', 3000);
            } else {
                showFeedback(j.erro || 'Erro ao assinar.');
            }
        } catch (e) {
            console.error(e);
            showFeedback('Erro de comunicação.');
        }
        return;
    }

    const nome = document.getElementById('nome').value.trim();
  const setor = document.getElementById('setor').value.trim();
  const inicio = document.getElementById('inicio').value;
  const tipoGozo = tipoGozoEl.value;
  const decimo = document.getElementById('decimo').value;
  
  // RH validation
  let statusRH = null;
  let sugestaoData = null;
  
  if (modeRH) {
      const selected = document.querySelector('input[name="statusRH"]:checked');
      if (!selected) {
          showFeedback('Selecione uma opção de aprovação.');
          return;
      }
      statusRH = selected.value;
      
      if (statusRH === 'reprovado') {
           sugestaoData = sugestaoDataEl.value;
           if (!justificativaRHEl || !justificativaRHEl.value.trim()) {
               showFeedback('Justificativa é obrigatória para reprovação.');
               return;
           }
      }
      
      const payload = {
          id: requestId,
          statusRH: statusRH,
          sugestaoData: sugestaoData,
          justificativa: justificativaRHEl ? justificativaRHEl.value.trim() : ''
      };

      try {
          const r = await fetch('/api/solicitacao/rh-aprovar', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
          });
          const j = await r.json();
          if (j.ok) {
              showFeedback('Processado com sucesso!', false);
              setTimeout(() => window.location.href = '/dashboard-rh.html', 2000);
          } else {
              showFeedback(j.erro || 'Erro ao processar.');
          }
      } catch (e) {
          console.error(e);
          showFeedback('Erro de comunicação.');
      }
      return;
  } else {
      // Normal validation
      // Signature is now collected AFTER RH approval
      /*
      if (!isSigned.val) {
        showFeedback('A assinatura do colaborador é obrigatória.');
        return;
      }
      */
  }

  const inicio2 = inicio2El.value;
  const gestorEmail = gestorEmailEl.value.trim();

  if (!modeRH && (!nome || !setor || !inicio || !tipoGozo)) {
    showFeedback('Preencha todos os campos obrigatórios.');
    return;
  }
  if (isSplit(tipoGozo) && !inicio2) {
    showFeedback('Informe o início do segundo período.');
    return;
  }
  
  const endpoint = modeRH ? '/api/solicitacao' : '/api/encaminhar';
  
  const dataURL = (isSigned.val) ? canvas.toDataURL('image/png') : null;

  try {
    const nomeGestor = document.getElementById('nomeGestor').value.trim();
    const body = { 
        nome, 
        setor, 
        inicio, 
        inicio2: isSplit(tipoGozo) ? inicio2 : undefined, 
        tipoGozo, 
        decimo, 
        gestorEmail: gestorEmail || undefined, 
        nomeGestor: nomeGestor || undefined 
    };
    if (requestId) body.id = requestId;
    
    if (modeRH) {
       body.statusRH = statusRH;
       body.sugestaoData = statusRH === 'reprovado' ? sugestaoData : undefined;
       body.justificativa = (statusRH === 'reprovado' && justificativaRHEl) ? justificativaRHEl.value : undefined;
       // Maintain existing signature if not provided (should be readonly anyway)
       // body.assinatura = dataURL; 
    } else {
       body.assinatura = dataURL;
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
        showFeedback(`Validação concluída com sucesso.${link}`, false);
        
        setTimeout(() => {
            window.location.href = '/protected/dashboard-rh.html';
        }, 2000);
    } else {
        showFeedback('Solicitação encaminhada ao RH com sucesso.', false);
        form.reset();
        limparBtn.click();
    }

  } catch (err) {
    console.error(err);
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
  const show = val === '15+15'; 
  periodoExtra.hidden = !show;
  if (!show) {
    inicio2El.value = '';
  }
});

radiosStatus.forEach(r => {
  r.addEventListener('change', () => {
    const isReprovado = r.value === 'reprovado';
    if(areaSugestao) areaSugestao.hidden = !isReprovado;
    if (!isReprovado && sugestaoDataEl) sugestaoDataEl.value = '';
  });
});

// --- Load Funcionarios (Integration) ---
const selectFuncionario = document.getElementById('select_funcionario');

if (selectFuncionario) {
    async function loadFuncionarios() {
        try {
            const res = await fetch('/api/funcionarios');
            const funcionarios = await res.json();
            
            selectFuncionario.innerHTML = '<option value="">Selecione um colaborador...</option>';
            // Ordenar por nome
            funcionarios.sort((a, b) => a.nome.localeCompare(b.nome));
            
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

    selectFuncionario.addEventListener('change', () => {
        const opt = selectFuncionario.selectedOptions[0];
        
        if (!opt || !opt.value) return;

        try {
            const dados = JSON.parse(opt.dataset.dados);
            
            const nomeEl = document.getElementById('nome');
            const setorEl = document.getElementById('setor');
            
            if (nomeEl && dados.nome) {
                nomeEl.value = dados.nome;
                nomeEl.style.transition = 'background-color 0.3s';
                nomeEl.style.backgroundColor = '#e0f2fe';
                setTimeout(() => nomeEl.style.backgroundColor = '', 1000);
            }
            
            const setorValor = dados.setor || dados.departamento;
            if (setorEl && setorValor) {
                setorEl.value = setorValor;
                setorEl.style.transition = 'background-color 0.3s';
                setorEl.style.backgroundColor = '#e0f2fe';
                setTimeout(() => setorEl.style.backgroundColor = '', 1000);
            }

        } catch (e) {
            console.error('Erro ao preencher dados:', e);
        }
    });
}
