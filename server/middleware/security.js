const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { body, validationResult } = require('express-validator');

// Configuração do Helmet para segurança
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "http://localhost:3000", "http://localhost:5000"],
    },
  },
  crossOriginEmbedderPolicy: false
});

// Rate limiting geral
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // limite de 100 requisições por IP
  message: {
    error: 'Muitas requisições deste IP, tente novamente mais tarde'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting para autenticação (mais restrito)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // limite de 5 tentativas de login por IP
  message: {
    error: 'Muitas tentativas de login, tente novamente em 15 minutos'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

// Rate limiting para criação de usuários
const createUserLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // limite de 3 criações de usuário por IP
  message: {
    error: 'Limite de criação de usuários excedido, tente novamente mais tarde'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting para criação de despesas
const expenseLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10, // limite de 10 despesas por usuário
  keyGenerator: (req) => {
    return req.user?.id?.toString() || req.ip;
  },
  message: {
    error: 'Limite de criação de despesas excedido, tente novamente em 1 minuto'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware de validação de erros
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Dados inválidos',
      details: errors.array().map(error => ({
        field: error.path,
        message: error.msg,
        value: error.value
      }))
    });
  }
  next();
};

// Validação para login
const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email inválido'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Senha deve ter pelo menos 6 caracteres'),
  handleValidationErrors
];

// Validação para criação de usuário
const validateUserCreation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Nome deve ter entre 2 e 100 caracteres')
    .matches(/^[a-zA-ZÀ-ÿ\s]+$/)
    .withMessage('Nome deve conter apenas letras e espaços'),
  
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email inválido'),
  
  body('password')
    .isLength({ min: 8 })
    .withMessage('Senha deve ter pelo menos 8 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Senha deve conter pelo menos uma letra maiúscula, uma minúscula, um número e um caractere especial'),
  
  body('role')
    .isIn(['admin', 'employee'])
    .withMessage('Função deve ser admin ou employee'),
  
  body('department')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Departamento deve ter no máximo 50 caracteres'),
  
  body('position')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Cargo deve ter no máximo 50 caracteres'),
  
  body('expense_limit')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Limite de gastos deve ser um número positivo'),
  
  handleValidationErrors
];

// Validação para criação de despesa
const validateExpenseCreation = [
  body('employee_id')
    .isInt({ min: 1 })
    .withMessage('ID do funcionário deve ser um número inteiro positivo'),
  
  body('description')
    .trim()
    .isLength({ min: 3, max: 500 })
    .withMessage('Descrição deve ter entre 3 e 500 caracteres'),
  
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Valor deve ser um número positivo maior que 0'),
  
  body('category')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Categoria deve ter entre 2 e 50 caracteres'),
  
  body('date')
    .isISO8601()
    .withMessage('Data deve estar em formato válido (YYYY-MM-DD)'),
  
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Prioridade deve ser low, medium, high ou urgent'),
  
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Observações devem ter no máximo 1000 caracteres'),
  
  body('tags')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Tags devem ter no máximo 200 caracteres'),
  
  handleValidationErrors
];

// Validação para atualização de status de despesa
const validateExpenseStatusUpdate = [
  body('status')
    .isIn(['pending', 'approved', 'rejected'])
    .withMessage('Status deve ser pending, approved ou rejected'),
  
  body('reason')
    .optional()
    .trim()
    .isLength({ min: 5, max: 500 })
    .withMessage('Motivo deve ter entre 5 e 500 caracteres'),
  
  handleValidationErrors
];

// Middleware para sanitização de inputs
const sanitizeInput = (req, res, next) => {
  // Remover caracteres perigosos de todos os inputs
  const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;
    return str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
              .replace(/javascript:/gi, '')
              .replace(/on\w+\s*=/gi, '');
  };

  const sanitizeObject = (obj) => {
    if (typeof obj !== 'object' || obj === null) return obj;
    
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        sanitized[key] = sanitizeString(value);
      } else if (typeof value === 'object') {
        sanitized[key] = sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  };

  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  next();
};

// Middleware para logging de segurança
const securityLogger = (req, res, next) => {
  const timestamp = new Date().toISOString();
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || 'Unknown';
  
  console.log(`[${timestamp}] ${req.method} ${req.path} - IP: ${ip} - User: ${req.user?.email || 'Anonymous'} - Agent: ${userAgent}`);
  
  // Log de tentativas de acesso suspeitas
  if (req.path.includes('/api/auth') && req.method === 'POST') {
    console.log(`[AUTH ATTEMPT] ${timestamp} - IP: ${ip} - Email: ${req.body?.email || 'Not provided'}`);
  }
  
  next();
};

module.exports = {
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
};
