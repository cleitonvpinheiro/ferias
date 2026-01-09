const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'import', 'FORM-RH-040 - FORMULÁRIO - AVALIAÇÃO DE PERFORMACE.xlsx');
const workbook = XLSX.readFile(filePath);

console.log('Sheets:', workbook.SheetNames);

workbook.SheetNames.forEach(sheetName => {
    console.log(`\n--- Sheet: ${sheetName} ---`);
    const worksheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 0, defval: '' });
    // Print first 10 rows to understand structure
    console.log(JSON.stringify(json.slice(0, 10), null, 2));
});