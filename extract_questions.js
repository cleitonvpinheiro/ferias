const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const filePath = path.join(__dirname, 'import', 'FORM-RH-040 - FORMULÁRIO - AVALIAÇÃO DE PERFORMACE.xlsx');
const workbook = XLSX.readFile(filePath);

const forms = {};

workbook.SheetNames.forEach(sheetName => {
    const worksheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    
    // Find where questions start. Usually after "COMPETÊNCIAS" header row or similar.
    // In the previous output, row 4 (index 4) had "COMPETENCIAS" "FUNCIONÁRIO(A):"
    // Row 8 (index 8) had the scores.
    // Row 9 (index 9) started the questions.
    
    const questions = [];
    let startRow = -1;
    
    // Simple heuristic to find start of questions: look for row with "ATENDE as expectations" or similar in column 3
    for(let i=0; i<json.length; i++) {
        const row = json[i];
        if(row[0] && row[1] && row[3] && String(row[3]).includes('ATENDE')) {
             // This is a question row
             questions.push({
                 category: row[0],
                 question: row[1]
             });
        }
    }
    
    forms[sheetName] = questions;
});

fs.writeFileSync(path.join(__dirname, 'form_questions.json'), JSON.stringify(forms, null, 2));
console.log('Questions extracted to form_questions.json');