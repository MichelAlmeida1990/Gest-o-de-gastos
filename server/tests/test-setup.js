const request = require('supertest');
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const multer = require('multer');
require('dotenv').config();

// Criar app de teste separado
const app = express();
const PORT = process.env.TEST_PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

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

// Conexão com banco de dados de teste
const db = new sqlite3.Database(':memory:');

// Criar tabelas de teste
db.serialize(() => {
  // Tabela de usuários
  db.run(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'employee',
      department TEXT,
      position TEXT,
      plan TEXT DEFAULT 'free',
      expense_limit REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabela de despesas
  db.run(`
    CREATE TABLE expenses (
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

  // Inserir usuário admin de teste
  const hashedPassword = bcrypt.hashSync('admin123', 10);
  db.run(`
    INSERT INTO users (name, email, password, role, plan) 
    VALUES (?, ?, ?, ?, ?)
  `, ['Administrador', 'admin@expenseflow.com', hashedPassword, 'admin', 'premium']);

  // Inserir usuário employee de teste
  const employeePassword = bcrypt.hashSync('123456', 10);
  db.run(`
    INSERT INTO users (name, email, password, role, department, position, plan, expense_limit) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, ['João Silva', 'joao@empresa.com', employeePassword, 'employee', 'TI', 'Desenvolvedor', 'premium', 1000]);
});

// Middleware de autenticação
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'test-secret', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido' });
    }
    req.user = user;
    next();
  });
};

// Rotas de autenticação
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Erro no servidor' });
    }

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        position: user.position,
        plan: user.plan,
        expense_limit: user.expense_limit
      }
    });
  });
});

// Rotas de usuários
app.get('/api/users', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  db.all('SELECT id, name, email, role, department, position, plan, expense_limit FROM users', (err, users) => {
    if (err) {
      return res.status(500).json({ error: 'Erro no servidor' });
    }
    res.json(users);
  });
});

app.post('/api/users', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  const { name, email, password, role, department, position, plan, expense_limit } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Campos obrigatórios não preenchidos' });
  }

  // Validar formato do email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Email inválido' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);

  db.run(`
    INSERT INTO users (name, email, password, role, department, position, plan, expense_limit) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [name, email, hashedPassword, role, department, position, plan, expense_limit], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: 'Email já existe' });
      }
      return res.status(500).json({ error: 'Erro no servidor' });
    }

    res.json({
      id: this.lastID,
      name,
      email,
      role,
      department,
      position,
      plan,
      expense_limit
    });
  });
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
  }

  query += ' ORDER BY e.created_at DESC';

  const params = req.user.role === 'employee' ? [req.user.id] : [];

  db.all(query, params, (err, expenses) => {
    if (err) {
      return res.status(500).json({ error: 'Erro no servidor' });
    }
    res.json(expenses);
  });
});

app.post('/api/expenses', authenticateToken, upload.single('receipt'), (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  const { employee_id, description, amount, category, date, priority, notes, tags } = req.body;

  if (!employee_id || !description || !amount || !category || !date) {
    return res.status(400).json({ error: 'Campos obrigatórios não preenchidos' });
  }

  const receipt_file = req.file ? req.file.filename : null;

  db.run(`
    INSERT INTO expenses (employee_id, description, amount, category, date, receipt_file, priority, notes, tags, created_by) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [employee_id, description, amount, category, date, receipt_file, priority, notes, tags, req.user.id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Erro no servidor' });
    }

    res.json({
      id: this.lastID,
      employee_id,
      description,
      amount,
      category,
      date,
      receipt_file,
      priority,
      notes,
      tags,
      created_by: req.user.id
    });
  });
});

app.put('/api/expenses/:id/status', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  const { status } = req.body;

  if (!['pending', 'approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Status inválido' });
  }

  db.run(
    'UPDATE expenses SET status = ? WHERE id = ?',
    [status, req.params.id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Erro no servidor' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Despesa não encontrada' });
      }

      res.json({ id: req.params.id, status });
    }
  );
});

app.put('/api/users/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  const { name, email, role, department, position, plan, expense_limit } = req.body;
  const userId = req.params.id;

  db.run(`
    UPDATE users 
    SET name = ?, email = ?, role = ?, department = ?, position = ?, plan = ?, expense_limit = ?
    WHERE id = ?
  `, [name, email, role, department, position, plan, expense_limit, userId], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Erro no servidor' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json({
      id: userId,
      name,
      email,
      role,
      department,
      position,
      plan,
      expense_limit
    });
  });
});

app.delete('/api/users/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  const userId = req.params.id;

  db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Erro no servidor' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json({ message: 'Usuário deletado com sucesso' });
  });
});
app.get('/api/reports/expenses/:format', authenticateToken, (req, res) => {
  if (!['pdf', 'excel'].includes(req.params.format)) {
    return res.status(404).json({ error: 'Formato inválido' });
  }

  // Mock response for testing
  if (req.params.format === 'pdf') {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="test-report.pdf"');
    res.send('mock-pdf-content');
  } else {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="test-report.xlsx"');
    res.send('mock-excel-content');
  }
});

app.get('/api/reports/departments/:format', authenticateToken, (req, res) => {
  if (!['pdf', 'excel'].includes(req.params.format)) {
    return res.status(404).json({ error: 'Formato inválido' });
  }

  // Mock response for testing
  if (req.params.format === 'pdf') {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="test-departments.pdf"');
    res.send('mock-pdf-content');
  } else {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="test-departments.xlsx"');
    res.send('mock-excel-content');
  }
});

module.exports = { app, db };
