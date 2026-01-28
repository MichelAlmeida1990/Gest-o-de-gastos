const request = require('supertest');
const { app } = require('./test-setup');

let authToken;

beforeAll(async () => {
  // Obter token de autenticação para testes
  const loginResponse = await request(app)
    .post('/api/auth/login')
    .send({
      email: 'admin@expenseflow.com',
      password: 'admin123'
    });
  
  authToken = loginResponse.body.token;
});

describe('Expenses API', () => {
  describe('GET /api/expenses', () => {
    it('should get expenses with valid token', async () => {
      const response = await request(app)
        .get('/api/expenses')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/expenses');

      expect(response.status).toBe(401);
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/expenses')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/expenses', () => {
    it('should create expense with valid data', async () => {
      const expenseData = {
        employee_id: 2, // Assuming user ID 2 exists
        description: 'Test expense',
        amount: 100.50,
        category: 'Alimentação',
        date: '2024-01-15',
        priority: 'medium',
        notes: 'Test notes'
      };

      const response = await request(app)
        .post('/api/expenses')
        .set('Authorization', `Bearer ${authToken}`)
        .send(expenseData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body.description).toBe(expenseData.description);
      expect(response.body.amount).toBe(expenseData.amount);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/expenses')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Test without required fields'
        });

      expect(response.status).toBe(400);
    });

    it('should reject non-admin users', async () => {
      // First login as employee
      const employeeLogin = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'joao@empresa.com',
          password: '123456'
        });

      const response = await request(app)
        .post('/api/expenses')
        .set('Authorization', `Bearer ${employeeLogin.body.token}`)
        .send({
          employee_id: 2,
          description: 'Test expense',
          amount: 100,
          category: 'Alimentação',
          date: '2024-01-15'
        });

      expect(response.status).toBe(403);
    });
  });

  describe('PUT /api/expenses/:id/status', () => {
    let expenseId;

    beforeAll(async () => {
      // Create a test expense to update
      const createResponse = await request(app)
        .post('/api/expenses')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          employee_id: 2,
          description: 'Test expense for status update',
          amount: 50,
          category: 'Transporte',
          date: '2024-01-15'
        });
      
      expenseId = createResponse.body.id;
    });

    it('should update expense status', async () => {
      const response = await request(app)
        .put(`/api/expenses/${expenseId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'approved'
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('approved');
    });

    it('should validate status values', async () => {
      const response = await request(app)
        .put(`/api/expenses/${expenseId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'invalid-status'
        });

      expect(response.status).toBe(400);
    });
  });
});
