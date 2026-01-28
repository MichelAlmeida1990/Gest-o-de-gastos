const jsPDF = require('jspdf');
const ExcelJS = require('exceljs');

class ReportService {
  async generateExpenseReport(expenses, format = 'pdf') {
    if (format === 'excel') {
      return await this.generateExcelReport(expenses);
    } else {
      return await this.generatePDFReport(expenses);
    }
  }

  async generatePDFReport(expenses) {
    const doc = new jsPDF();
    
    // Configurações iniciais
    doc.setFontSize(20);
    doc.text('Relatório de Despesas', 20, 20);
    
    doc.setFontSize(12);
    doc.text(`Data de geração: ${new Date().toLocaleDateString('pt-BR')}`, 20, 35);
    doc.text(`Total de despesas: ${expenses.length}`, 20, 45);
    
    const totalAmount = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    doc.text(`Valor total: R$ ${totalAmount.toFixed(2)}`, 20, 55);
    
    // Cabeçalho da tabela
    let yPosition = 75;
    doc.setFontSize(10);
    doc.text('ID', 20, yPosition);
    doc.text('Funcionário', 40, yPosition);
    doc.text('Descrição', 80, yPosition);
    doc.text('Valor', 140, yPosition);
    doc.text('Status', 170, yPosition);
    
    // Dados da tabela
    yPosition += 10;
    expenses.forEach((expense, index) => {
      if (yPosition > 270) {
        doc.addPage();
        yPosition = 20;
      }
      
      doc.text(expense.id.toString(), 20, yPosition);
      doc.text(expense.employee_name || 'N/A', 40, yPosition);
      doc.text(expense.description.substring(0, 30), 80, yPosition);
      doc.text(`R$ ${expense.amount.toFixed(2)}`, 140, yPosition);
      doc.text(expense.status, 170, yPosition);
      
      yPosition += 8;
    });
    
    return Buffer.from(doc.output('arraybuffer'));
  }

  async generateExcelReport(expenses) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Relatório de Despesas');
    
    // Configurações da planilha
    worksheet.properties.defaultColWidth = 15;
    
    // Cabeçalhos
    const headers = [
      'ID', 'Funcionário', 'Descrição', 'Valor', 'Categoria', 
      'Data', 'Status', 'Notas', 'Criado em'
    ];
    
    worksheet.addRow(headers);
    
    // Estilo para cabeçalho
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
    
    // Dados
    expenses.forEach(expense => {
      worksheet.addRow([
        expense.id,
        expense.employee_name || 'N/A',
        expense.description,
        expense.amount,
        expense.category,
        new Date(expense.date).toLocaleDateString('pt-BR'),
        expense.status,
        expense.notes || '',
        new Date(expense.created_at).toLocaleDateString('pt-BR')
      ]);
    });
    
    // Formatação da coluna de valor
    worksheet.getColumn('D').numFmt = '"R$ "#,##0.00';
    
    // Auto-ajustar colunas
    worksheet.columns.forEach(column => {
      column.width = Math.max(10, column.header.length + 2);
    });
    
    // Adicionar totais
    const totalRow = worksheet.addRow([
      '', '', '', '', '', '', '', '', ''
    ]);
    
    const totalAmount = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const totalRowIndex = worksheet.rowCount;
    
    worksheet.getCell(`D${totalRowIndex}`).value = totalAmount;
    worksheet.getCell(`D${totalRowIndex}`).font = { bold: true };
    worksheet.getCell(`C${totalRowIndex}`).value = 'TOTAL:';
    worksheet.getCell(`C${totalRowIndex}`).font = { bold: true };
    
    return await workbook.xlsx.writeBuffer();
  }

  async generateDepartmentReport(departments, format = 'pdf') {
    if (format === 'excel') {
      return await this.generateDepartmentExcelReport(departments);
    } else {
      return await this.generateDepartmentPDFReport(departments);
    }
  }

  async generateDepartmentPDFReport(departments) {
    const doc = new jsPDF();
    
    // Configurações iniciais
    doc.setFontSize(20);
    doc.text('Relatório por Departamento', 20, 20);
    
    doc.setFontSize(12);
    doc.text(`Data de geração: ${new Date().toLocaleDateString('pt-BR')}`, 20, 35);
    
    let yPosition = 55;
    
    departments.forEach(dept => {
      if (yPosition > 250) {
        doc.addPage();
        yPosition = 20;
      }
      
      doc.setFontSize(14);
      doc.text(dept.name, 20, yPosition);
      yPosition += 10;
      
      doc.setFontSize(10);
      doc.text(`Orçamento: R$ ${dept.budget_limit.toFixed(2)}`, 30, yPosition);
      yPosition += 8;
      doc.text(`Gasto: R$ ${dept.current_spent.toFixed(2)}`, 30, yPosition);
      yPosition += 8;
      doc.text(`Disponível: R$ ${(dept.budget_limit - dept.current_spent).toFixed(2)}`, 30, yPosition);
      yPosition += 8;
      
      const utilizationRate = (dept.current_spent / dept.budget_limit) * 100;
      doc.text(`Utilização: ${utilizationRate.toFixed(1)}%`, 30, yPosition);
      yPosition += 15;
    });
    
    return Buffer.from(doc.output('arraybuffer'));
  }

  async generateDepartmentExcelReport(departments) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Relatório por Departamento');
    
    // Cabeçalhos
    const headers = [
      'Departamento', 'Orçamento', 'Gasto', 'Disponível', 'Taxa de Utilização (%)'
    ];
    
    worksheet.addRow(headers);
    
    // Estilo para cabeçalho
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
    
    // Dados
    departments.forEach(dept => {
      const utilizationRate = (dept.current_spent / dept.budget_limit) * 100;
      
      worksheet.addRow([
        dept.name,
        dept.budget_limit,
        dept.current_spent,
        dept.budget_limit - dept.current_spent,
        utilizationRate.toFixed(1)
      ]);
    });
    
    // Formatação das colunas monetárias
    worksheet.getColumn('B').numFmt = '"R$ "#,##0.00';
    worksheet.getColumn('C').numFmt = '"R$ "#,##0.00';
    worksheet.getColumn('D').numFmt = '"R$ "#,##0.00';
    worksheet.getColumn('E').numFmt = '0.0"%';
    
    // Auto-ajustar colunas
    worksheet.columns.forEach(column => {
      column.width = Math.max(12, column.header.length + 2);
    });
    
    return await workbook.xlsx.writeBuffer();
  }
}

module.exports = new ReportService();
