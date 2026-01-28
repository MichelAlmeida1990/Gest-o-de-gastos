const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Controle de Gastos API',
      version: '1.0.0',
      description: 'API para gerenciamento de despesas e controle de gastos empresariais',
      contact: {
        name: 'API Support',
        email: 'support@expenseflow.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Servidor de desenvolvimento'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        User: {
          type: 'object',
          required: ['name', 'email', 'password', 'role'],
          properties: {
            id: {
              type: 'integer',
              description: 'ID do usuário'
            },
            name: {
              type: 'string',
              description: 'Nome do usuário'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Email do usuário'
            },
            role: {
              type: 'string',
              enum: ['admin', 'employee'],
              description: 'Função do usuário'
            },
            department: {
              type: 'string',
              description: 'Departamento do usuário'
            },
            position: {
              type: 'string',
              description: 'Cargo do usuário'
            },
            expense_limit: {
              type: 'number',
              description: 'Limite de gastos'
            }
          }
        },
        Expense: {
          type: 'object',
          required: ['employee_id', 'description', 'amount', 'category', 'date'],
          properties: {
            id: {
              type: 'integer',
              description: 'ID da despesa'
            },
            employee_id: {
              type: 'integer',
              description: 'ID do funcionário'
            },
            description: {
              type: 'string',
              description: 'Descrição da despesa'
            },
            amount: {
              type: 'number',
              description: 'Valor da despesa'
            },
            category: {
              type: 'string',
              description: 'Categoria da despesa'
            },
            date: {
              type: 'string',
              format: 'date',
              description: 'Data da despesa'
            },
            receipt_file: {
              type: 'string',
              description: 'Arquivo do recibo'
            },
            status: {
              type: 'string',
              enum: ['pending', 'approved', 'rejected'],
              description: 'Status da despesa'
            },
            notes: {
              type: 'string',
              description: 'Observações'
            },
            tags: {
              type: 'string',
              description: 'Tags da despesa'
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'urgent'],
              description: 'Prioridade da despesa'
            }
          }
        },
        AuthResponse: {
          type: 'object',
          properties: {
            token: {
              type: 'string',
              description: 'Token JWT'
            },
            user: {
              $ref: '#/components/schemas/User'
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Mensagem de erro'
            }
          }
        }
      }
    }
  },
  apis: ['./index.js'], // Caminho para os arquivos com anotações Swagger
};

const specs = swaggerJsdoc(options);

module.exports = {
  swaggerUi,
  specs
};
