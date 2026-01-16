const express = require('express');
const cors = require('cors');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
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
      plan TEXT DEFAULT 'free',
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
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES users(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
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

  // Criar admin padrão
  const hashedPassword = bcrypt.hashSync('admin123', 10);
  db.run(`
    INSERT OR IGNORE INTO users (name, email, password, role, plan) 
    VALUES (?, ?, ?, ?, ?)
  `, ['Administrador', 'admin@expenseflow.com', hashedPassword, 'admin', 'premium']);
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
app.post('/api/auth/login', (req, res) => {
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
        role: user.role,
        plan: user.plan
      }
    });
  });
});

// Rotas de usuários
app.get('/api/users', authenticateToken, (req, res) => {
  console.log('GET /api/users - User:', req.user);
  
  if (req.user.role !== 'admin') {
    console.log('Access denied - not admin');
    return res.status(403).json({ error: 'Acesso negado' });
  }

  db.all('SELECT id, name, email, role, department, position, plan, expense_limit, created_at FROM users', (err, users) => {
    if (err) {
      console.log('Database error:', err);
      return res.status(500).json({ error: 'Erro no servidor' });
    }
    console.log('Users found:', users.length);
    res.json(users);
  });
});

app.post('/api/users', authenticateToken, (req, res) => {
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

app.post('/api/expenses', authenticateToken, upload.single('receipt'), (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  const { employee_id, description, amount, category, date, notes } = req.body;
  const receipt_file = req.file ? req.file.filename : null;

  db.run(
    'INSERT INTO expenses (employee_id, description, amount, category, date, receipt_file, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [employee_id, description, amount, category, date, receipt_file, notes, req.user.id],
    function(err) {
      if (err) return res.status(500).json({ error: 'Erro ao criar despesa' });
      res.json({ id: this.lastID, message: 'Despesa criada com sucesso' });
    }
  );
});

app.put('/api/expenses/:id/status', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  const { status } = req.body;
  
  db.run(
    'UPDATE expenses SET status = ? WHERE id = ?',
    [status, req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: 'Erro ao atualizar despesa' });
      res.json({ message: 'Status atualizado com sucesso' });
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

// Rota de dashboard
app.get('/api/dashboard', authenticateToken, (req, res) => {
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

  if (req.user.role === 'employee') {
    query += ' WHERE employee_id = ?';
    db.get(query, [req.user.id], (err, stats) => {
      if (err) return res.status(500).json({ error: 'Erro no servidor' });
      res.json(stats);
    });
  } else {
    db.get(query, (err, stats) => {
      if (err) return res.status(500).json({ error: 'Erro no servidor' });
      res.json(stats);
    });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
