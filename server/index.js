const express = require('express');
const cors = require('cors');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const { Server } = require('socket.io');
const http = require('http');
const reportService = require('./services/reportService');
const { swaggerUi, specs } = require('./docs/swagger');
const emailService = require('./services/emailService');
const alertService = require('./services/alertService');
const cacheService = require('./services/cacheService');
const {
  securityHeaders,
  generalLimiter,
  authLimiter,
  createUserLimiter,
  expenseLimiter,
  validateLogin,
  validateUserCreation,
  validateExpenseCreation,
  validateExpenseStatusUpdate,
  sanitizeInput,
  securityLogger
} = require('./middleware/security');
require('dotenv').config();

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: Operações de autenticação
 *   name: Users
 *   description: Gerenciamento de usuários
 *   name: Expenses
 *   description: Gerenciamento de despesas
 *   name: Reports
 *   description: Geração de relatórios
 */

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5000;

// Middleware
app.use(securityHeaders);
app.use(securityLogger);
app.use(generalLimiter);
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configuração do Multer para upload de arquivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });

// Conexão com o banco de dados SQLite
const db = new sqlite3.Database('./database.sqlite');

// Criar tabelas
db.serialize(() => {
  // Tabela de usuários
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'employee',
      department TEXT,
      position TEXT,
      expense_limit REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabela de despesas
  db.run(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      date DATE NOT NULL,
      receipt_file TEXT,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
      notes TEXT,
      tags TEXT,
      priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES users(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  // Verificar e adicionar coluna tags se não existir
  db.run(`ALTER TABLE expenses ADD COLUMN tags TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.log('Coluna tags já existe ou erro:', err.message);
    } else {
      console.log('Coluna tags adicionada com sucesso');
    }
  });

  // Verificar e adicionar coluna priority se não existir
  db.run(`ALTER TABLE expenses ADD COLUMN priority TEXT DEFAULT 'medium'`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.log('Coluna priority já existe ou erro:', err.message);
    } else {
      console.log('Coluna priority adicionada com sucesso');
    }
  });

  // Tabela de tags
  db.run(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      color TEXT DEFAULT '#1976d2',
      category TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabela de alertas
  db.run(`
    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK (type IN ('budget', 'expense', 'anomaly', 'deadline')),
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
      department_id INTEGER,
      user_id INTEGER,
      expense_id INTEGER,
      threshold_value REAL,
      current_value REAL,
      is_read BOOLEAN DEFAULT FALSE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME,
      FOREIGN KEY (department_id) REFERENCES departments(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (expense_id) REFERENCES expenses(id)
    )
  `);

  // Tabela de departamentos
  db.run(`
    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      budget_limit REAL DEFAULT 0,
      current_spent REAL DEFAULT 0,
      manager_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (manager_id) REFERENCES users(id)
    )
  `);

  // Tabela de categorias
  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Inserir categorias padrão
  const categories = [
    'Alimentação', 'Transporte', 'Hospedagem', 'Material de Escritório',
    'Serviços', 'Marketing', 'Treinamento', 'Outros'
  ];

  categories.forEach(category => {
    db.run('INSERT OR IGNORE INTO categories (name) VALUES (?)', [category]);
  });

  // Inserir tags padrão
  const defaultTags = [
    { name: 'Urgente', color: '#f44336', category: 'prioridade' },
    { name: 'Viagem', color: '#ff9800', category: 'tipo' },
    { name: 'Cliente', color: '#4caf50', category: 'tipo' },
    { name: 'Reembolsável', color: '#2196f3', category: 'financeiro' },
    { name: 'Projeto', color: '#9c27b0', category: 'tipo' },
    { name: 'Emergência', color: '#f44336', category: 'prioridade' },
    { name: 'Treinamento', color: '#00bcd4', category: 'tipo' },
    { name: 'Marketing', color: '#ff5722', category: 'departamento' },
    { name: 'TI', color: '#3f51b5', category: 'departamento' },
    { name: 'RH', color: '#795548', category: 'departamento' }
  ];

  defaultTags.forEach(tag => {
    db.run('INSERT OR IGNORE INTO tags (name, color, category) VALUES (?, ?, ?)', 
           [tag.name, tag.color, tag.category]);
  });

  // Inserir departamentos padrão
  const departments = [
    { name: 'TI', budget_limit: 5000 },
    { name: 'Marketing', budget_limit: 3000 },
    { name: 'RH', budget_limit: 2000 },
    { name: 'Vendas', budget_limit: 4000 },
    { name: 'Financeiro', budget_limit: 1500 }
  ];

  departments.forEach(dept => {
    db.run('INSERT OR IGNORE INTO departments (name, budget_limit) VALUES (?, ?)', 
           [dept.name, dept.budget_limit]);
  });

  // Criar admin padrão
  const hashedPassword = bcrypt.hashSync('admin123', 10);
  db.run(`
    INSERT OR IGNORE INTO users (name, email, password, role) 
    VALUES (?, ?, ?, ?)
  `, ['Administrador', 'admin@expenseflow.com', hashedPassword, 'admin']);

  // Criar usuários de exemplo
  const sampleUsers = [
    { name: 'João Silva', email: 'joao@empresa.com', password: '123456', role: 'employee', department: 'TI', position: 'Desenvolvedor', expense_limit: 1000 },
    { name: 'Maria Santos', email: 'maria@empresa.com', password: '123456', role: 'employee', department: 'Marketing', position: 'Gerente', expense_limit: 1500 },
    { name: 'Pedro Costa', email: 'pedro@empresa.com', password: '123456', role: 'employee', department: 'RH', position: 'Analista', expense_limit: 500 },
    { name: 'Ana Oliveira', email: 'ana@empresa.com', password: '123456', role: 'employee', department: 'Vendas', position: 'Vendedora', expense_limit: 800 },
    { name: 'Carlos Ferreira', email: 'carlos@empresa.com', password: '123456', role: 'employee', department: 'Financeiro', position: 'Analista', expense_limit: 600 }
  ];

  sampleUsers.forEach(user => {
    const hashedPassword = bcrypt.hashSync(user.password, 10);
    db.run(`
      INSERT OR IGNORE INTO users (name, email, password, role, department, position, expense_limit) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [user.name, user.email, hashedPassword, user.role, user.department, user.position, user.expense_limit]);
  });
});

// Middleware de autenticação
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'secretpassword', (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido' });
    req.user = user;
    next();
  });
};

// Rotas de autenticação
/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Authentication]
 *     summary: Realiza login do usuário
 *     description: Autentica um usuário e retorna um token JWT
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email do usuário
 *               password:
 *                 type: string
 *                 description: Senha do usuário
 *     responses:
 *       200:
 *         description: Login realizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Credenciais inválidas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.post('/api/auth/login', authLimiter, validateLogin, (req, res) => {
  const { email, password } = req.body;

  db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
    if (err) return res.status(500).json({ error: 'Erro no servidor' });
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'secretpassword',
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  });
});

// Rotas de usuários com cache
app.get('/api/users', authenticateToken, cacheService.cacheMiddleware(
  cacheService.CACHE_KEYS.USER_LIST,
  300 // Cache de 5 minutos para lista de usuários
), async (req, res) => {
  console.log('GET /api/users - User:', req.user);
  
  if (req.user.role !== 'admin') {
    console.log('Access denied - not admin');
    return res.status(403).json({ error: 'Acesso negado' });
  }

  try {
    const users = await cacheService.getOrSet(cacheService.CACHE_KEYS.USER_LIST, async () => {
      return new Promise((resolve, reject) => {
        db.all('SELECT id, name, email, role, department, position, expense_limit FROM users', (err, users) => {
          if (err) return reject(err);
          console.log('Users found:', users.length);
          resolve(users);
        });
      });
    }, 300);

    res.json(users);
  } catch (error) {
    console.log('Database error:', error);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

app.post('/api/users', authenticateToken, createUserLimiter, validateUserCreation, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  const { name, email, password, role, department, position, expense_limit } = req.body;
  const hashedPassword = bcrypt.hashSync(password, 10);

  db.run(
    'INSERT INTO users (name, email, password, role, department, position, expense_limit) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [name, email, hashedPassword, role, department, position, expense_limit || 0],
    function(err) {
      if (err) return res.status(500).json({ error: 'Erro ao criar usuário' });
      
      // Enviar email de boas-vindas de forma assíncrona
      emailService.sendWelcomeEmail(email, name).then(emailResult => {
        if (emailResult.success) {
          console.log('Email de boas-vindas enviado para:', email);
        } else {
          console.error('Falha ao enviar email de boas-vindas:', emailResult.error);
        }
      });
      
      // Invalidar cache de usuários
      cacheService.invalidate(cacheService.CACHE_KEYS.USER_LIST);
      cacheService.invalidate(cacheService.CACHE_KEYS.DASHBOARD_METRICS);
      
      res.json({ id: this.lastID, name, email, role, department, position, expense_limit: expense_limit || 0 });
    }
  );
});

// Rotas de despesas
app.get('/api/expenses', authenticateToken, (req, res) => {
  let query = `
    SELECT e.*, u.name as employee_name, creator.name as created_by_name 
    FROM expenses e
    JOIN users u ON e.employee_id = u.id
    JOIN users creator ON e.created_by = creator.id
  `;

  if (req.user.role === 'employee') {
    query += ' WHERE e.employee_id = ?';
    db.all(query, [req.user.id], (err, expenses) => {
      if (err) return res.status(500).json({ error: 'Erro no servidor' });
      res.json(expenses);
    });
  } else {
    db.all(query, (err, expenses) => {
      if (err) return res.status(500).json({ error: 'Erro no servidor' });
      res.json(expenses);
    });
  }
});

app.post('/api/expenses', authenticateToken, expenseLimiter, upload.single('receipt'), (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  const { employee_id, description, amount, category, date, notes, tags, priority } = req.body;
  const receipt_file = req.file ? req.file.filename : null;

  // Validação manual dos campos obrigatórios
  if (!employee_id || !description || !amount || !category || !date) {
    return res.status(400).json({ 
      error: 'Campos obrigatórios faltando',
      missing: {
        employee_id: !employee_id,
        description: !description,
        amount: !amount,
        category: !category,
        date: !date
      }
    });
  }

  // Validação de tipos
  const employeeIdNum = parseInt(employee_id);
  if (isNaN(employeeIdNum) || employeeIdNum <= 0) {
    return res.status(400).json({ error: 'ID do funcionário inválido' });
  }

  const amountNum = parseFloat(amount);
  if (isNaN(amountNum) || amountNum <= 0) {
    return res.status(400).json({ error: 'Valor inválido' });
  }

  console.log('Dados da despesa:', { employee_id, description, amount, category, date, priority });

  // Primeiro, obter o departamento do funcionário
  db.get('SELECT department FROM users WHERE id = ?', [employee_id], (err, user) => {
    if (err) return res.status(500).json({ error: 'Erro no servidor' });
    if (!user) return res.status(404).json({ error: 'Funcionário não encontrado' });

    // Inserir a despesa
    const tagsArray = Array.isArray(tags) ? tags.join(',') : (tags || '');
    console.log('Inserindo despesa:', { employee_id, description, amount, category, date, receipt_file, notes, tags: tagsArray, priority, created_by: req.user.id });
    
    db.run(
      'INSERT INTO expenses (employee_id, description, amount, category, date, receipt_file, notes, tags, priority, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [employee_id, description, amount, category, date, receipt_file, notes, tagsArray, priority || 'medium', req.user.id],
      function(err) {
        if (err) {
          console.error('Erro ao inserir despesa:', err);
          return res.status(500).json({ error: 'Erro ao criar despesa', details: err.message });
        }

        // Se o funcionário tem departamento, atualizar o orçamento
        if (user.department) {
          db.get('SELECT id FROM departments WHERE name = ?', [user.department], (err, dept) => {
            if (!err && dept) {
              db.run(
                'UPDATE departments SET current_spent = current_spent + ? WHERE id = ?',
                [parseFloat(amount), dept.id]
              );
            }
          });
        }

        res.json({ id: this.lastID, message: 'Despesa criada com sucesso' });
        
        // Emitir atualização em tempo real
        broadcastUpdate('expense-created', {
          id: this.lastID,
          employee_id,
          description,
          amount: parseFloat(amount),
          category,
          date,
          tags,
          priority: priority || 'medium',
          status: 'pending'
        });
        
        // Enviar atualização de dashboard
        broadcastUpdate('dashboard-update', { type: 'expense' }, 'admin');
      }
    );
  });
});

app.put('/api/expenses/:id/status', authenticateToken, validateExpenseStatusUpdate, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  const { status, reason } = req.body;
  
  // Primeiro, obter os detalhes da despesa para enviar notificação
  db.get(
    'SELECT e.*, u.email, u.name as user_name FROM expenses e JOIN users u ON e.employee_id = u.id WHERE e.id = ?',
    [req.params.id],
    (err, expense) => {
      if (err) return res.status(500).json({ error: 'Erro ao atualizar despesa' });
      
      if (!expense) return res.status(404).json({ error: 'Despesa não encontrada' });
      
      db.run(
        'UPDATE expenses SET status = ? WHERE id = ?',
        [status, req.params.id],
        function(err) {
          if (err) return res.status(500).json({ error: 'Erro ao atualizar despesa' });
          
          // Enviar notificação por email de forma assíncrona
          if (status === 'approved') {
            emailService.sendExpenseApprovedEmail(expense.email, expense.user_name, expense).then(emailResult => {
              if (emailResult.success) {
                console.log('Email de aprovação enviado para:', expense.email);
              } else {
                console.error('Falha ao enviar email de aprovação:', emailResult.error);
              }
            });
          } else if (status === 'rejected') {
            emailService.sendExpenseRejectedEmail(expense.email, expense.user_name, expense, reason).then(emailResult => {
              if (emailResult.success) {
                console.log('Email de rejeição enviado para:', expense.email);
              } else {
                console.error('Falha ao enviar email de rejeição:', emailResult.error);
              }
            });
          }
          
          res.json({ message: 'Status atualizado com sucesso' });
          
          // Emitir atualização em tempo real
          broadcastUpdate('expense-status-updated', {
            id: req.params.id,
            status
          });
          
          // Enviar atualização de dashboard
          broadcastUpdate('dashboard-update', { type: 'status' }, 'admin');
        }
      );
    }
  );
});

// Rotas de categorias
app.get('/api/categories', authenticateToken, (req, res) => {
  db.all('SELECT * FROM categories ORDER BY name', (err, categories) => {
    if (err) return res.status(500).json({ error: 'Erro no servidor' });
    res.json(categories);
  });
});

// Rotas de departamentos
app.get('/api/departments', authenticateToken, (req, res) => {
  db.all(`
    SELECT d.*, u.name as manager_name, 
           (d.budget_limit - d.current_spent) as remaining_budget,
           CASE 
             WHEN d.current_spent > d.budget_limit THEN 'exceeded'
             WHEN d.current_spent > (d.budget_limit * 0.8) THEN 'warning'
             ELSE 'ok'
           END as budget_status
    FROM departments d
    LEFT JOIN users u ON d.manager_id = u.id
    ORDER BY d.name
  `, (err, departments) => {
    if (err) return res.status(500).json({ error: 'Erro no servidor' });
    res.json(departments);
  });
});

app.post('/api/departments', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  const { name, budget_limit, manager_id } = req.body;
  
  db.run(
    'INSERT INTO departments (name, budget_limit, manager_id) VALUES (?, ?, ?)',
    [name, budget_limit || 0, manager_id || null],
    function(err) {
      if (err) return res.status(500).json({ error: 'Erro ao criar departamento' });
      res.json({ id: this.lastID, name, budget_limit, manager_id });
    }
  );
});

app.put('/api/departments/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  const { name, budget_limit, manager_id } = req.body;
  
  db.run(
    'UPDATE departments SET name = ?, budget_limit = ?, manager_id = ? WHERE id = ?',
    [name, budget_limit, manager_id, req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: 'Erro ao atualizar departamento' });
      res.json({ message: 'Departamento atualizado com sucesso' });
    }
  );
});

app.delete('/api/departments/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  db.run('DELETE FROM departments WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: 'Erro ao deletar departamento' });
    res.json({ message: 'Departamento deletado com sucesso' });
  });
});

// Rotas de tags
app.get('/api/tags', authenticateToken, (req, res) => {
  db.all('SELECT * FROM tags ORDER BY category, name', (err, tags) => {
    if (err) return res.status(500).json({ error: 'Erro no servidor' });
    res.json(tags);
  });
});

app.post('/api/tags', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  const { name, color, category } = req.body;
  
  db.run(
    'INSERT INTO tags (name, color, category) VALUES (?, ?, ?)',
    [name, color || '#1976d2', category || 'geral'],
    function(err) {
      if (err) return res.status(500).json({ error: 'Erro ao criar tag' });
      res.json({ id: this.lastID, name, color, category });
    }
  );
});

app.delete('/api/tags/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  db.run('DELETE FROM tags WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: 'Erro ao deletar tag' });
    res.json({ message: 'Tag deletada com sucesso' });
  });
});

// Rotas de alertas
app.get('/api/alerts', authenticateToken, (req, res) => {
  let query = `
    SELECT a.*, 
           d.name as department_name,
           u.name as user_name,
           e.description as expense_description,
           e.amount as expense_amount
    FROM alerts a
    LEFT JOIN departments d ON a.department_id = d.id
    LEFT JOIN users u ON a.user_id = u.id
    LEFT JOIN expenses e ON a.expense_id = e.id
    WHERE a.created_at > date('now', '-30 days')
  `;
  
  if (req.user.role === 'employee') {
    query += ' AND a.user_id = ?';
    db.all(query, [req.user.id], (err, alerts) => {
      if (err) return res.status(500).json({ error: 'Erro no servidor' });
      res.json(alerts);
    });
  } else {
    query += ' ORDER BY a.created_at DESC';
    db.all(query, (err, alerts) => {
      if (err) return res.status(500).json({ error: 'Erro no servidor' });
      res.json(alerts);
    });
  }
});

app.put('/api/alerts/:id/read', authenticateToken, (req, res) => {
  db.run(
    'UPDATE alerts SET is_read = TRUE WHERE id = ?',
    [req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: 'Erro ao marcar alerta como lido' });
      res.json({ message: 'Alerta marcado como lido' });
    }
  );
});

app.get('/api/alerts/stats', authenticateToken, (req, res) => {
  const query = req.user.role === 'admin' 
    ? 'SELECT type, severity, COUNT(*) as count FROM alerts WHERE created_at > date("now", "-7 days") GROUP BY type, severity'
    : 'SELECT type, severity, COUNT(*) as count FROM alerts WHERE user_id = ? AND created_at > date("now", "-7 days") GROUP BY type, severity';
  
  const params = req.user.role === 'admin' ? [] : [req.user.id];
  
  db.all(query, params, (err, stats) => {
    if (err) return res.status(500).json({ error: 'Erro no servidor' });
    res.json(stats);
  });
});

// Rota para atualizar orçamento gasto do departamento
app.put('/api/departments/:id/budget', authenticateToken, (req, res) => {
  const { amount } = req.body;
  
  db.run(
    'UPDATE departments SET current_spent = current_spent + ? WHERE id = ?',
    [amount, req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: 'Erro ao atualizar orçamento' });
      res.json({ message: 'Orçamento atualizado com sucesso' });
    }
  );
});

// Adicionar rota para atualizar usuário
app.put('/api/users/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  const { name, email, role, department, position, expense_limit } = req.body;
  
  db.run(
    'UPDATE users SET name = ?, email = ?, role = ?, department = ?, position = ?, expense_limit = ? WHERE id = ?',
    [name, email, role, department, position, expense_limit || 0, req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: 'Erro ao atualizar usuário' });
      res.json({ message: 'Usuário atualizado com sucesso' });
    }
  );
});

// Adicionar rota para deletar usuário
app.delete('/api/users/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  db.run('DELETE FROM users WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: 'Erro ao deletar usuário' });
    res.json({ message: 'Usuário deletado com sucesso' });
  });
});

// Rota de dashboard com cache
app.get('/api/dashboard', authenticateToken, cacheService.cacheMiddleware(
  (req) => `${cacheService.CACHE_KEYS.DASHBOARD_METRICS}_${req.user.role}_${req.user.id}`,
  60 // Cache de 1 minuto para dashboard
), async (req, res) => {
  try {
    const cacheKey = req.user.role === 'employee' 
      ? `${cacheService.CACHE_KEYS.DASHBOARD_METRICS}_employee_${req.user.id}`
      : cacheService.CACHE_KEYS.DASHBOARD_METRICS;
    
    const stats = await cacheService.getOrSet(cacheKey, async () => {
      return new Promise((resolve, reject) => {
        let query = `
          SELECT 
            COUNT(*) as total_expenses,
            SUM(amount) as total_amount,
            AVG(amount) as avg_amount,
            COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
            COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
            COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_count
          FROM expenses
        `;

        const params = req.user.role === 'employee' ? [req.user.id] : [];
        
        if (req.user.role === 'employee') {
          query += ' WHERE employee_id = ?';
        }

        db.get(query, params, (err, stats) => {
          if (err) return reject(err);
          resolve(stats);
        });
      });
    }, 60);

    res.json(stats);
  } catch (error) {
    console.error('Erro ao obter dados do dashboard:', error);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// Função para gerar alertas inteligentes
const generateAlerts = () => {
  // Verificar alertas de orçamento
  db.all(`
    SELECT d.*, u.name as manager_name
    FROM departments d
    LEFT JOIN users u ON d.manager_id = u.id
    WHERE d.current_spent > d.budget_limit * 0.8
  `, (err, departments) => {
    if (err) return;
    
    departments.forEach(dept => {
      const percentage = (dept.current_spent / dept.budget_limit) * 100;
      let severity = 'medium';
      let type = 'budget';
      
      if (dept.current_spent >= dept.budget_limit) {
        severity = 'critical';
        type = 'budget';
      } else if (percentage >= 90) {
        severity = 'high';
        type = 'budget';
      }
      
      // Verificar se alerta já existe
      db.get(`
        SELECT id FROM alerts 
        WHERE type = ? AND department_id = ? AND created_at > date('now', '-1 day')
      `, [type, dept.id], (err, existingAlert) => {
        if (!err && !existingAlert) {
          db.run(`
            INSERT INTO alerts (type, title, message, severity, department_id, threshold_value, current_value)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [
            type,
            `Alerta de Orçamento - ${dept.name}`,
            `Departamento ${dept.name} utilizou ${percentage.toFixed(1)}% do orçamento (R$ ${dept.current_spent.toFixed(2)} / R$ ${dept.budget_limit.toFixed(2)})`,
            severity,
            dept.id,
            dept.budget_limit,
            dept.current_spent
          ]);
          
          // Emitir alerta em tempo real
          broadcastUpdate('budget-alert', {
            type: 'budget',
            department: dept.name,
            percentage,
            severity,
            message: `Orçamento de ${dept.name} em ${percentage.toFixed(1)}%`
          }, 'admin');
        }
      });
    });
  });
  
  // Verificar despesas anômalas (valores muito altos)
  db.get(`
    SELECT AVG(amount) as avg_amount, STDDEV(amount) as std_amount
    FROM expenses 
    WHERE status = 'approved' 
    AND created_at > date('now', '-3 months')
  `, (err, stats) => {
    if (err || !stats) return;
    
    const threshold = stats.avg_amount + (2 * stats.std_amount); // 2 desvios padrão
    
    db.all(`
      SELECT e.*, u.name as employee_name
      FROM expenses e
      JOIN users u ON e.employee_id = u.id
      WHERE e.amount > ? AND e.created_at > date('now', '-7 days')
      AND e.id NOT IN (
        SELECT expense_id FROM alerts WHERE expense_id IS NOT NULL
      )
    `, [threshold], (err, anomalousExpenses) => {
      if (err) return;
      
      anomalousExpenses.forEach(expense => {
        db.run(`
          INSERT INTO alerts (type, title, message, severity, user_id, expense_id, threshold_value, current_value)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          'anomaly',
          'Despesa Anômala Detectada',
          `Despesa de R$ ${expense.amount.toFixed(2)} detectada como anômala para ${expense.employee_name}`,
          'high',
          expense.employee_id,
          expense.id,
          threshold,
          expense.amount
        ]);
        
        broadcastUpdate('anomaly-alert', {
          type: 'anomaly',
          expense: expense.description,
          amount: expense.amount,
          employee: expense.employee_name
        }, 'admin');
      });
    });
  });
};

// Executar verificação de alertas a cada 5 minutos
setInterval(generateAlerts, 5 * 60 * 1000);

// Executar verificação imediata
generateAlerts();
io.on('connection', (socket) => {
  console.log('Novo cliente conectado:', socket.id);

  // Entrar em sala específica (admin ou employee)
  socket.on('join-room', (userRole) => {
    socket.join(userRole);
    console.log(`Usuário ${socket.id} entrou na sala ${userRole}`);
  });

  // Enviar atualizações em tempo real
  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
  });
});

// Função para emitir atualizações
// Rotas de exportação de relatórios
app.get('/api/reports/expenses/:format', authenticateToken, async (req, res) => {
  try {
    const { format } = req.params;
    const { 
      startDate, 
      endDate, 
      status, 
      department, 
      employee,
      expenseIds 
    } = req.query;
    
    let query = `
      SELECT e.*, u.name as employee_name, d.name as department_name
      FROM expenses e
      JOIN users u ON e.employee_id = u.id
      LEFT JOIN departments d ON u.department = d.name
      WHERE 1=1
    `;
    
    const params = [];
    
    if (startDate) {
      query += ' AND e.date >= ?';
      params.push(startDate);
    }
    
    if (endDate) {
      query += ' AND e.date <= ?';
      params.push(endDate);
    }
    
    if (status) {
      query += ' AND e.status = ?';
      params.push(status);
    }
    
    if (department) {
      query += ' AND d.name = ?';
      params.push(department);
    }
    
    if (employee) {
      query += ' AND e.employee_id = ?';
      params.push(employee);
    }
    
    // Adicionar filtro para IDs específicos de despesas
    if (expenseIds) {
      const ids = expenseIds.split(',').map(id => id.trim()).filter(id => id);
      if (ids.length > 0) {
        query += ` AND e.id IN (${ids.map(() => '?').join(',')})`;
        params.push(...ids);
      }
    }
    
    query += ' ORDER BY e.created_at DESC';
    
    db.all(query, params, async (err, expenses) => {
      if (err) {
        return res.status(500).json({ error: 'Erro ao buscar despesas' });
      }
      
      try {
        const reportBuffer = await reportService.generateExpenseReport(expenses, format);
        
        const filename = `relatorio-despesas-${new Date().toISOString().split('T')[0]}.${format}`;
        
        if (format === 'excel') {
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        } else {
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        }
        
        res.send(reportBuffer);
      } catch (reportError) {
        console.error('Erro ao gerar relatório:', reportError);
        res.status(500).json({ error: 'Erro ao gerar relatório' });
      }
    });
  } catch (error) {
    console.error('Erro na rota de relatório:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.get('/api/reports/departments/:format', authenticateToken, async (req, res) => {
  try {
    const { format } = req.params;
    
    db.all(`
      SELECT d.*, 
             (SELECT COUNT(*) FROM expenses e 
              JOIN users u ON e.employee_id = u.id 
              WHERE u.department = d.name) as expense_count
      FROM departments d
      ORDER BY d.name
    `, async (err, departments) => {
      if (err) {
        return res.status(500).json({ error: 'Erro ao buscar departamentos' });
      }
      
      try {
        const reportBuffer = await reportService.generateDepartmentReport(departments, format);
        
        const filename = `relatorio-departamentos-${new Date().toISOString().split('T')[0]}.${format}`;
        
        if (format === 'excel') {
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        } else {
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        }
        
        res.send(reportBuffer);
      } catch (reportError) {
        console.error('Erro ao gerar relatório:', reportError);
        res.status(500).json({ error: 'Erro ao gerar relatório' });
      }
    });
  } catch (error) {
    console.error('Erro na rota de relatório:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

const broadcastUpdate = (event, data, room = null) => {
  if (room) {
    io.to(room).emit(event, data);
  } else {
    io.emit(event, data);
  }
};

// Rota de documentação Swagger
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

/**
 * @swagger
 * /api-docs:
 *   get:
 *     summary: Documentação da API
 *     description: Acessa a interface Swagger UI para documentação da API
 *     responses:
 *       200:
 *         description: Documentação carregada com sucesso
 */

/**
 * @swagger
 * /api/alerts/check-limits:
 *   post:
 *     tags: [Alerts]
 *     summary: Verificar limites de gastos
 *     description: Verifica os limites de gastos de todos os usuários e envia alertas por email
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Alertas verificados com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       403:
 *         description: Acesso negado
 */
app.post('/api/alerts/check-limits', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  
  alertService.checkExpenseLimits(db);
  res.json({ message: 'Verificação de limites iniciada' });
});

/**
 * @swagger
 * /api/alerts/monthly-report:
 *   post:
 *     tags: [Alerts]
 *     summary: Gerar relatórios mensais
 *     description: Gera e envia relatórios mensais por email para todos os usuários
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Relatórios gerados com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       403:
 *         description: Acesso negado
 */
app.post('/api/alerts/monthly-report', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  
  alertService.generateMonthlyReports(db);
  res.json({ message: 'Geração de relatórios mensais iniciada' });
});

/**
 * @swagger
 * /api/cache/stats:
 *   get:
 *     tags: [Cache]
 *     summary: Estatísticas do cache
 *     description: Obtém estatísticas de performance do cache
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estatísticas do cache
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 keys:
 *                   type: number
 *                 hits:
 *                   type: number
 *                 misses:
 *                   type: number
 *                 hitRate:
 *                   type: string
 *       403:
 *         description: Acesso negado
 */
app.get('/api/cache/stats', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  
  const stats = cacheService.getStats();
  res.json(stats);
});

/**
 * @swagger
 * /api/cache/clear:
 *   post:
 *     tags: [Cache]
 *     summary: Limpar cache
 *     description: Limpa todo o cache do sistema
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cache limpo com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       403:
 *         description: Acesso negado
 */
app.post('/api/cache/clear', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  
  cacheService.clear();
  res.json({ message: 'Cache limpo com sucesso' });
});

server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Documentação disponível em: http://localhost:${PORT}/api-docs`);
  
  // Iniciar sistema de alertas
  alertService.scheduleAlerts(db);
  
  // Verificar limites imediatamente ao iniciar
  setTimeout(() => {
    alertService.checkExpenseLimits(db);
  }, 5000); // Aguardar 5 segundos para garantir que o banco está pronto
});
