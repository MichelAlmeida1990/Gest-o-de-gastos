const nodemailer = require('nodemailer');

// Configuração do transporter de email
const createTransporter = () => {
  // Para desenvolvimento, usamos Ethereal (email falso)
  // Em produção, configure com um serviço real (Gmail, Outlook, etc.)
  return nodemailer.createTransporter({
    host: process.env.EMAIL_HOST || 'smtp.ethereal.email',
    port: process.env.EMAIL_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER || 'ethereal.user@ethereal.email',
      pass: process.env.EMAIL_PASS || 'ethereal.password'
    }
  });
};

// Função para enviar email de boas-vindas
const sendWelcomeEmail = async (userEmail, userName) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || '"ExpenseFlow" <noreply@expenseflow.com>',
      to: userEmail,
      subject: 'Bem-vindo ao ExpenseFlow!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center; color: white;">
            <h1>ExpenseFlow</h1>
            <p>Sistema de Controle de Gastos</p>
          </div>
          
          <div style="padding: 30px; background-color: #f9f9f9;">
            <h2>Olá, ${userName}!</h2>
            <p>Seja bem-vindo ao ExpenseFlow! Sua conta foi criada com sucesso.</p>
            
            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>Próximos passos:</h3>
              <ul>
                <li>Faça login no sistema com suas credenciais</li>
                <li>Explore o dashboard e suas funcionalidades</li>
                <li>Comece a registrar suas despesas</li>
              </ul>
            </div>
            
            <div style="background-color: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h4>Dados de acesso:</h4>
              <p><strong>Email:</strong> ${userEmail}</p>
              <p><strong>Sistema:</strong> <a href="http://localhost:3000">ExpenseFlow</a></p>
            </div>
            
            <p style="text-align: center; margin-top: 30px;">
              <a href="http://localhost:3000" style="background-color: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Acessar Sistema
              </a>
            </p>
          </div>
          
          <div style="background-color: #333; color: white; padding: 20px; text-align: center; font-size: 12px;">
            <p>&copy; 2024 ExpenseFlow. Todos os direitos reservados.</p>
            <p>Este é um email automático, por favor não responda.</p>
          </div>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email de boas-vindas enviado:', info.messageId);
    
    return {
      success: true,
      messageId: info.messageId,
      preview: nodemailer.getTestMessageUrl(info)
    };
  } catch (error) {
    console.error('Erro ao enviar email de boas-vindas:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Função para enviar notificação de despesa aprovada
const sendExpenseApprovedEmail = async (userEmail, userName, expenseData) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || '"ExpenseFlow" <noreply@expenseflow.com>',
      to: userEmail,
      subject: 'Despesa Aprovada - ExpenseFlow',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #4caf50 0%, #45a049 100%); padding: 20px; text-align: center; color: white;">
            <h1>✅ Despesa Aprovada</h1>
            <p>ExpenseFlow</p>
          </div>
          
          <div style="padding: 30px; background-color: #f9f9f9;">
            <h2>Olá, ${userName}!</h2>
            <p>Sua despesa foi aprovada e está sendo processada.</p>
            
            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4caf50;">
              <h3>Detalhes da Despesa:</h3>
              <p><strong>Descrição:</strong> ${expenseData.description}</p>
              <p><strong>Valor:</strong> R$ ${expenseData.amount.toFixed(2)}</p>
              <p><strong>Categoria:</strong> ${expenseData.category}</p>
              <p><strong>Data:</strong> ${new Date(expenseData.date).toLocaleDateString('pt-BR')}</p>
              ${expenseData.notes ? `<p><strong>Observações:</strong> ${expenseData.notes}</p>` : ''}
            </div>
            
            <p style="text-align: center; margin-top: 30px;">
              <a href="http://localhost:3000" style="background-color: #4caf50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Ver Despesas
              </a>
            </p>
          </div>
          
          <div style="background-color: #333; color: white; padding: 20px; text-align: center; font-size: 12px;">
            <p>&copy; 2024 ExpenseFlow. Todos os direitos reservados.</p>
            <p>Este é um email automático, por favor não responda.</p>
          </div>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email de aprovação enviado:', info.messageId);
    
    return {
      success: true,
      messageId: info.messageId,
      preview: nodemailer.getTestMessageUrl(info)
    };
  } catch (error) {
    console.error('Erro ao enviar email de aprovação:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Função para enviar notificação de despesa rejeitada
const sendExpenseRejectedEmail = async (userEmail, userName, expenseData, reason) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || '"ExpenseFlow" <noreply@expenseflow.com>',
      to: userEmail,
      subject: 'Despesa Rejeitada - ExpenseFlow',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%); padding: 20px; text-align: center; color: white;">
            <h1>❌ Despesa Rejeitada</h1>
            <p>ExpenseFlow</p>
          </div>
          
          <div style="padding: 30px; background-color: #f9f9f9;">
            <h2>Olá, ${userName}!</h2>
            <p>Sua despesa foi rejeitada pelo administrador.</p>
            
            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f44336;">
              <h3>Detalhes da Despesa:</h3>
              <p><strong>Descrição:</strong> ${expenseData.description}</p>
              <p><strong>Valor:</strong> R$ ${expenseData.amount.toFixed(2)}</p>
              <p><strong>Categoria:</strong> ${expenseData.category}</p>
              <p><strong>Data:</strong> ${new Date(expenseData.date).toLocaleDateString('pt-BR')}</p>
              ${expenseData.notes ? `<p><strong>Observações:</strong> ${expenseData.notes}</p>` : ''}
            </div>
            
            <div style="background-color: #ffebee; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h4>Motivo da rejeição:</h4>
              <p>${reason || 'Não especificado'}</p>
            </div>
            
            <p style="text-align: center; margin-top: 30px;">
              <a href="http://localhost:3000" style="background-color: #f44336; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Ver Despesas
              </a>
            </p>
          </div>
          
          <div style="background-color: #333; color: white; padding: 20px; text-align: center; font-size: 12px;">
            <p>&copy; 2024 ExpenseFlow. Todos os direitos reservados.</p>
            <p>Este é um email automático, por favor não responda.</p>
          </div>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email de rejeição enviado:', info.messageId);
    
    return {
      success: true,
      messageId: info.messageId,
      preview: nodemailer.getTestMessageUrl(info)
    };
  } catch (error) {
    console.error('Erro ao enviar email de rejeição:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Função para enviar alerta de limite de gastos
const sendExpenseLimitEmail = async (userEmail, userName, limitData) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || '"ExpenseFlow" <noreply@expenseflow.com>',
      to: userEmail,
      subject: '⚠️ Alerta de Limite de Gastos - ExpenseFlow',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%); padding: 20px; text-align: center; color: white;">
            <h1>⚠️ Alerta de Limite</h1>
            <p>ExpenseFlow</p>
          </div>
          
          <div style="padding: 30px; background-color: #f9f9f9;">
            <h2>Olá, ${userName}!</h2>
            <p>Você está approaching seu limite de gastos mensal.</p>
            
            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ff9800;">
              <h3>Resumo do Mês:</h3>
              <p><strong>Limite mensal:</strong> R$ ${limitData.limit.toFixed(2)}</p>
              <p><strong>Gastos atuais:</strong> R$ ${limitData.current.toFixed(2)}</p>
              <p><strong>Disponível:</strong> R$ ${limitData.available.toFixed(2)}</p>
              <p><strong>Porcentagem utilizada:</strong> ${limitData.percentage.toFixed(1)}%</p>
            </div>
            
            <div style="background-color: #fff3e0; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h4>Recomendações:</h4>
              <ul>
                <li>Revise suas despesas pendentes</li>
                <li>Priorize despesas essenciais</li>
                <li>Considere adicionar despesas não urgentes para o próximo mês</li>
              </ul>
            </div>
            
            <p style="text-align: center; margin-top: 30px;">
              <a href="http://localhost:3000" style="background-color: #ff9800; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Ver Dashboard
              </a>
            </p>
          </div>
          
          <div style="background-color: #333; color: white; padding: 20px; text-align: center; font-size: 12px;">
            <p>&copy; 2024 ExpenseFlow. Todos os direitos reservados.</p>
            <p>Este é um email automático, por favor não responda.</p>
          </div>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email de alerta de limite enviado:', info.messageId);
    
    return {
      success: true,
      messageId: info.messageId,
      preview: nodemailer.getTestMessageUrl(info)
    };
  } catch (error) {
    console.error('Erro ao enviar email de alerta:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Função para enviar relatório mensal
const sendMonthlyReportEmail = async (userEmail, userName, reportData) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || '"ExpenseFlow" <noreply@expenseflow.com>',
      to: userEmail,
      subject: '📊 Relatório Mensal - ExpenseFlow',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #2196f3 0%, #1976d2 100%); padding: 20px; text-align: center; color: white;">
            <h1>📊 Relatório Mensal</h1>
            <p>ExpenseFlow</p>
          </div>
          
          <div style="padding: 30px; background-color: #f9f9f9;">
            <h2>Olá, ${userName}!</h2>
            <p>Seu relatório mensal de gastos está pronto.</p>
            
            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>Resumo do Mês:</h3>
              <p><strong>Total de despesas:</strong> ${reportData.totalExpenses}</p>
              <p><strong>Valor total:</strong> R$ ${reportData.totalAmount.toFixed(2)}</p>
              <p><strong>Média por despesa:</strong> R$ ${reportData.averageAmount.toFixed(2)}</p>
              <p><strong>Categoria mais frequente:</strong> ${reportData.topCategory}</p>
            </div>
            
            <div style="background-color: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h4>Distribuição por Categoria:</h4>
              ${Object.entries(reportData.categories).map(([category, data]) => 
                `<p><strong>${category}:</strong> ${data.count} despesas, R$ ${data.total.toFixed(2)}</p>`
              ).join('')}
            </div>
            
            <p style="text-align: center; margin-top: 30px;">
              <a href="http://localhost:3000" style="background-color: #2196f3; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Ver Relatório Completo
              </a>
            </p>
          </div>
          
          <div style="background-color: #333; color: white; padding: 20px; text-align: center; font-size: 12px;">
            <p>&copy; 2024 ExpenseFlow. Todos os direitos reservados.</p>
            <p>Este é um email automático, por favor não responda.</p>
          </div>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email de relatório mensal enviado:', info.messageId);
    
    return {
      success: true,
      messageId: info.messageId,
      preview: nodemailer.getTestMessageUrl(info)
    };
  } catch (error) {
    console.error('Erro ao enviar email de relatório:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  sendWelcomeEmail,
  sendExpenseApprovedEmail,
  sendExpenseRejectedEmail,
  sendExpenseLimitEmail,
  sendMonthlyReportEmail
};
