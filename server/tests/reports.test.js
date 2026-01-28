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

describe('Reports API', () => {
  describe('GET /api/reports/expenses/:format', () => {
    it('should generate PDF report', async () => {
      const response = await request(app)
        .get('/api/reports/expenses/pdf')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toContain('attachment');
    });

    it('should generate Excel report', async () => {
      const response = await request(app)
        .get('/api/reports/expenses/excel')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(response.headers['content-disposition']).toContain('attachment');
    });

    it('should apply date filters', async () => {
      const response = await request(app)
        .get('/api/reports/expenses/pdf?startDate=2024-01-01&endDate=2024-12-31')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
    });

    it('should apply status filter', async () => {
      const response = await request(app)
        .get('/api/reports/expenses/pdf?status=pending')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
    });

    it('should apply department filter', async () => {
      const response = await request(app)
        .get('/api/reports/expenses/pdf?department=TI')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
    });

    it('should reject invalid format', async () => {
      const response = await request(app)
        .get('/api/reports/expenses/invalid')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/reports/expenses/pdf');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/reports/departments/:format', () => {
    it('should generate departments PDF report', async () => {
      const response = await request(app)
        .get('/api/reports/departments/pdf')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toContain('attachment');
    });

    it('should generate departments Excel report', async () => {
      const response = await request(app)
        .get('/api/reports/departments/excel')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(response.headers['content-disposition']).toContain('attachment');
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/reports/departments/pdf');

      expect(response.status).toBe(401);
    });
  });
});
