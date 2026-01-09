
// Dicionário de traduções (simplificado)
const translations = {
    pt: {
        formTitle: "Formulário de Recrutamento",
        personalData: "Dados Pessoais",
        candidateName: "Nome do Candidato:",
        naturalidade: "Naturalidade:",
        birthDate: "Data de Nascimento:",
        age: "Idade:",
        address: "Endereço:",
        neighborhood: "Bairro:",
        city: "Cidade:",
        phone: "Telefone:",
        recado: "Recado:",
        rg: "RG / RNE:",
        cpf: "CPF:",
        race: "Raça/Etnia:",
        email: "Email:",
        civilStatus: "Estado Civil:",
        children: "Filhos menores de idade?",
        childrenQuantity: "Se sim, quantos?",
        education: "Escolaridade:",
        vtCardNumber: "Nº do cartão VT:",
        workInformation: "Informações de Trabalho",
        worked: "Já trabalhou no Madalosso?",
        periodAndFunction: "Qual período e função?",
        shirt: "Camiseta:",
        pants: "Calça:",
        shoe: "Sapato (nº):",
        professionalExperience: "Experiência Profissional",
        lastCompany: "Última Empresa:",
        cargo: "Cargo:",
        lastSalary: "Último Salário:",
        admission: "Admissão:",
        departure: "Saída:",
        reasonForDeparture: "Motivo da saída:",
        penultimateCompany: "Penúltima Empresa:",
        otherInformation: "Outras Informações",
        availability: "Disponibilidade de Horário:",
        salaryPretension: "Pretensão Salarial:",
        attachResume: "Anexe seu Currículo",
        consentTerm: "Termo de Consentimento",
        consentText: "Em observância à Lei 13.709/18 (LGPD), autorizo a empresa IRMÃOS MADALOSSO LTDA a tratar meus dados pessoais para fins de recrutamento e seleção.",
        authorizeTreatment: "Autorizo o tratamento dos meus dados",
        send: "Enviar",
        successMessage: "Candidatura enviada com sucesso!",
        errorMessage: "Erro ao enviar candidatura. Tente novamente."
    },
    es: {
        formTitle: "Formulario de Reclutamiento",
        personalData: "Datos Personales",
        candidateName: "Nombre del Candidato:",
        naturalidade: "Naturalidad:",
        birthDate: "Fecha de Nacimiento:",
        age: "Edad:",
        address: "Dirección:",
        neighborhood: "Barrio:",
        city: "Ciudad:",
        phone: "Teléfono:",
        recado: "Mensaje/Recado:",
        rg: "RG / RNE:",
        cpf: "CPF:",
        race: "Raza/Etnia:",
        email: "Email:",
        civilStatus: "Estado Civil:",
        children: "¿Hijos menores de edad?",
        childrenQuantity: "Si sí, ¿cuántos?",
        education: "Escolaridad:",
        vtCardNumber: "Nº de tarjeta VT:",
        workInformation: "Información Laboral",
        worked: "¿Ya trabajó en Madalosso?",
        periodAndFunction: "¿Qué período y función?",
        shirt: "Camiseta:",
        pants: "Pantalón:",
        shoe: "Zapato (nº):",
        professionalExperience: "Experiencia Profesional",
        lastCompany: "Última Empresa:",
        cargo: "Cargo:",
        lastSalary: "Último Salario:",
        admission: "Admisión:",
        departure: "Salida:",
        reasonForDeparture: "Motivo de salida:",
        penultimateCompany: "Penúltima Empresa:",
        otherInformation: "Otras Informaciones",
        availability: "Disponibilidad de Horario:",
        salaryPretension: "Pretensión Salarial:",
        attachResume: "Adjuntar Currículum",
        consentTerm: "Término de Consentimiento",
        consentText: "En cumplimiento con la Ley 13.709/18 (LGPD), autorizo a la empresa IRMÃOS MADALOSSO LTDA a tratar mis datos personales para fines de reclutamiento y selección.",
        authorizeTreatment: "Autorizo el tratamiento de mis datos",
        send: "Enviar",
        successMessage: "¡Candidatura enviada con éxito!",
        errorMessage: "Error al enviar candidatura. Intente nuevamente."
    },
    en: {
        formTitle: "Recruitment Form",
        personalData: "Personal Data",
        candidateName: "Candidate Name:",
        naturalidade: "Place of Birth:",
        birthDate: "Date of Birth:",
        age: "Age:",
        address: "Address:",
        neighborhood: "Neighborhood:",
        city: "City:",
        phone: "Phone:",
        recado: "Message:",
        rg: "ID / RNE:",
        cpf: "CPF:",
        race: "Race/Ethnicity:",
        email: "Email:",
        civilStatus: "Marital Status:",
        children: "Minor children?",
        childrenQuantity: "If yes, how many?",
        education: "Education:",
        vtCardNumber: "VT Card Number:",
        workInformation: "Work Information",
        worked: "Have you worked at Madalosso?",
        periodAndFunction: "What period and role?",
        shirt: "Shirt Size:",
        pants: "Pants Size:",
        shoe: "Shoe Size:",
        professionalExperience: "Professional Experience",
        lastCompany: "Last Company:",
        cargo: "Role:",
        lastSalary: "Last Salary:",
        admission: "Admission:",
        departure: "Departure:",
        reasonForDeparture: "Reason for departure:",
        penultimateCompany: "Penultimate Company:",
        otherInformation: "Other Information",
        availability: "Schedule Availability:",
        salaryPretension: "Salary Expectation:",
        attachResume: "Attach Resume",
        consentTerm: "Consent Term",
        consentText: "In compliance with Law 13.709/18 (LGPD), I authorize IRMÃOS MADALOSSO LTDA to process my personal data for recruitment and selection purposes.",
        authorizeTreatment: "I authorize the processing of my data",
        send: "Send",
        successMessage: "Application sent successfully!",
        errorMessage: "Error sending application. Please try again."
    }
};

// Configuração de idioma
const langSelect = document.getElementById('language-select');
function updateLanguage(lang) {
    const texts = translations[lang];
    document.querySelectorAll('[data-translate]').forEach(el => {
        const key = el.getAttribute('data-translate');
        if (texts[key]) {
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                el.placeholder = texts[key];
            } else {
                el.textContent = texts[key];
            }
        }
    });
    // Atualiza opções de select se necessário (aqui mantemos simples)
}

if (langSelect) {
    langSelect.addEventListener('change', (e) => updateLanguage(e.target.value));
    // Inicializa
    updateLanguage('pt');
}

// Manipulação do Formulário
const form = document.getElementById('formTalentos');
const feedback = document.getElementById('feedback');

// Função auxiliar para ler arquivo como Base64
const fileToBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Enviando...';
    
    try {
        const formData = new FormData(form);
        const payload = Object.fromEntries(formData.entries());
        
        // Tratar arquivo
        const fileInput = document.getElementById('curriculo');
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            if (file.size > 5 * 1024 * 1024) { // 5MB limit check
                throw new Error('O arquivo é muito grande (máx 5MB).');
            }
            payload.curriculo = await fileToBase64(file);
        }

        // Remover o campo de arquivo original do payload para não enviar lixo JSON
        delete payload.curriculoFile;

        const res = await fetch('/api/candidaturas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        
        if (res.ok) {
            // Sucesso: Esconder formulário e mostrar mensagem de agradecimento
            form.style.display = 'none';
            
            const container = document.querySelector('.container');
            const successDiv = document.createElement('div');
            successDiv.style.textAlign = 'center';
            successDiv.style.padding = '40px 20px';
            successDiv.innerHTML = `
                <div style="font-size: 48px; margin-bottom: 20px;">✅</div>
                <h2 style="color: #166534; margin-bottom: 10px;">${translations[langSelect.value || 'pt'].successMessage}</h2>
                <p style="color: #64748b;">Recebemos suas informações. Boa sorte!</p>
                <button onclick="window.location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer;">Voltar</button>
            `;
            container.appendChild(successDiv);
            
            // Rolar para o topo
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            alert(data.erro || translations[langSelect.value || 'pt'].errorMessage);
        }
    } catch (err) {
        console.error(err);
        alert('Erro: ' + err.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = translations[langSelect.value || 'pt'].send;
    }
});
