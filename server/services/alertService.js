const emailService = require('./emailService');

// Função para verificar limites de gastos e enviar alertas
const checkExpenseLimits = (db) => {
  console.log('Verificando limites de gastos...');
  
  // Obter todos os usuários com limite definido
  db.all(
    'SELECT id, name, email, expense_limit FROM users WHERE expense_limit > 0',
    (err, users) => {
      if (err) {
        console.error('Erro ao buscar usuários para verificação de limites:', err);
        return;
      }
      
      users.forEach(user => {
        // Calcular gastos do mês atual
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();
        
        db.get(
          `SELECT COALESCE(SUM(amount), 0) as total_expenses, COUNT(*) as expense_count 
           FROM expenses 
           WHERE employee_id = ? AND status = 'approved' 
           AND strftime('%m', date) = ? AND strftime('%Y', date) = ?`,
          [user.id, currentMonth.toString().padStart(2, '0'), currentYear.toString()],
          (err, result) => {
            if (err) {
              console.error(`Erro ao calcular gastos do usuário ${user.name}:`, err);
              return;
            }
            
            const currentExpenses = result.total_expenses;
            const percentage = (currentExpenses / user.expense_limit) * 100;
            const available = user.expense_limit - currentExpenses;
            
            // Enviar alertas baseados na porcentagem utilizada
            if (percentage >= 90 && percentage < 100) {
              // Alerta crítico - 90% ou mais
              emailService.sendExpenseLimitEmail(user.email, user.name, {
                limit: user.expense_limit,
                current: currentExpenses,
                available: available,
                percentage: percentage,
                level: 'critical'
              }).then(emailResult => {
                if (emailResult.success) {
                  console.log(`Alerta crítico enviado para ${user.name} (${percentage.toFixed(1)}%)`);
                }
              });
            } else if (percentage >= 75 && percentage < 90) {
              // Alerta de atenção - 75% a 89%
              emailService.sendExpenseLimitEmail(user.email, user.name, {
                limit: user.expense_limit,
                current: currentExpenses,
                available: available,
                percentage: percentage,
                level: 'warning'
              }).then(emailResult => {
                if (emailResult.success) {
                  console.log(`Alerta de atenção enviado para ${user.name} (${percentage.toFixed(1)}%)`);
                }
              });
            } else if (percentage >= 50 && percentage < 75) {
              // Aviso informativo - 50% a 74%
              emailService.sendExpenseLimitEmail(user.email, user.name, {
                limit: user.expense_limit,
                current: currentExpenses,
                available: available,
                percentage: percentage,
                level: 'info'
              }).then(emailResult => {
                if (emailResult.success) {
                  console.log(`Aviso informativo enviado para ${user.name} (${percentage.toFixed(1)}%)`);
                }
              });
            }
          }
        );
      });
    }
  );
};

// Função para gerar e enviar relatórios mensais
const generateMonthlyReports = (db) => {
  console.log('Gerando relatórios mensais...');
  
  const lastMonth = new Date();
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  const month = lastMonth.getMonth() + 1;
  const year = lastMonth.getFullYear();
  
  // Obter todos os usuários
  db.all('SELECT id, name, email FROM users', (err, users) => {
    if (err) {
      console.error('Erro ao buscar usuários para relatório mensal:', err);
      return;
    }
    
    users.forEach(user => {
      // Obter dados do relatório do usuário
      db.all(
        `SELECT category, COUNT(*) as count, SUM(amount) as total
         FROM expenses 
         WHERE employee_id = ? AND status = 'approved'
         AND strftime('%m', date) = ? AND strftime('%Y', date) = ?
         GROUP BY category`,
        [user.id, month.toString().padStart(2, '0'), year.toString()],
        (err, categories) => {
          if (err) {
            console.error(`Erro ao gerar relatório para ${user.name}:`, err);
            return;
          }
          
          // Obter totais gerais
          db.get(
            `SELECT COUNT(*) as total_expenses, SUM(amount) as total_amount
             FROM expenses 
             WHERE employee_id = ? AND status = 'approved'
             AND strftime('%m', date) = ? AND strftime('%Y', date) = ?`,
            [user.id, month.toString().padStart(2, '0'), year.toString()],
            (err, totals) => {
              if (err) {
                console.error(`Erro ao calcular totais para ${user.name}:`, err);
                return;
              }
              
              // Preparar dados do relatório
              const reportData = {
                totalExpenses: totals.total_expenses || 0,
                totalAmount: totals.total_amount || 0,
                averageAmount: totals.total_expenses > 0 ? (totals.total_amount / totals.total_expenses) : 0,
                categories: {},
                topCategory: categories.length > 0 ? categories[0].category : 'Nenhuma'
              };
              
              // Organizar categorias
              categories.forEach(cat => {
                reportData.categories[cat.category] = {
                  count: cat.count,
                  total: cat.total
                };
              });
              
              // Enviar relatório por email
              if (reportData.totalExpenses > 0) {
                emailService.sendMonthlyReportEmail(user.email, user.name, reportData).then(emailResult => {
                  if (emailResult.success) {
                    console.log(`Relatório mensal enviado para ${user.name}`);
                  }
                });
              }
            }
          );
        }
      );
    });
  });
};

// Função para agendar verificações periódicas
const scheduleAlerts = (db) => {
  // Verificar limites a cada hora
  setInterval(() => {
    checkExpenseLimits(db);
  }, 60 * 60 * 1000); // 1 hora
  
  // Gerar relatórios mensais no dia 1 de cada mês
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  
  const timeUntilTomorrow = tomorrow - now;
  
  setTimeout(() => {
    generateMonthlyReports(db);
    
    // Agendar para o próximo mês
    setInterval(() => {
      generateMonthlyReports(db);
    }, 30 * 24 * 60 * 60 * 1000); // 30 dias
  }, timeUntilTomorrow);
  
  console.log('Sistema de alertas agendado com sucesso');
};

module.exports = {
  checkExpenseLimits,
  generateMonthlyReports,
  scheduleAlerts
};
