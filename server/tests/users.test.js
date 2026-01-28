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

describe('Users API', () => {
  describe('GET /api/users', () => {
    it('should get users with valid admin token', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should reject non-admin users', async () => {
      // Login as employee
      const employeeLogin = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'joao@empresa.com',
          password: '123456'
        });

      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${employeeLogin.body.token}`);

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/users', () => {
    it('should create user with valid data', async () => {
      const userData = {
        name: 'Test User',
        email: 'testuser@test.com',
        password: 'testpass123',
        role: 'employee',
        department: 'TI',
        position: 'Developer',
        plan: 'free',
        expense_limit: 500
      };

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send(userData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(userData.name);
      expect(response.body.email).toBe(userData.email);
      expect(response.body).not.toHaveProperty('password'); // Password should not be returned
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test User'
          // Missing required fields
        });

      expect(response.status).toBe(400);
    });

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test User',
          email: 'invalid-email',
          password: 'testpass123',
          role: 'employee'
        });

      expect(response.status).toBe(400);
    });

    it('should reject duplicate email', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Another User',
          email: 'admin@expenseflow.com', // Existing email
          password: 'testpass123',
          role: 'employee'
        });

      expect(response.status).toBe(400);
    });
  });

  describe('PUT /api/users/:id', () => {
    let userId;

    beforeAll(async () => {
      // Create a test user to update
      const createResponse = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'User to Update',
          email: 'updatetest@test.com',
          password: 'testpass123',
          role: 'employee',
          department: 'TI'
        });
      
      userId = createResponse.body.id;
    });

    it('should update user with valid data', async () => {
      const updateData = {
        name: 'Updated User Name',
        department: 'Marketing',
        position: 'Manager'
      };

      const response = await request(app)
        .put(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.name).toBe(updateData.name);
      expect(response.body.department).toBe(updateData.department);
    });

    it('should reject updating non-existent user', async () => {
      const response = await request(app)
        .put('/api/users/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated Name'
        });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/users/:id', () => {
    let userId;

    beforeAll(async () => {
      // Create a test user to delete
      const createResponse = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'User to Delete',
          email: 'deletetest@test.com',
          password: 'testpass123',
          role: 'employee'
        });
      
      userId = createResponse.body.id;
    });

    it('should delete user', async () => {
      const response = await request(app)
        .delete(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('deletado com sucesso');
    });

    it('should reject deleting non-existent user', async () => {
      const response = await request(app)
        .delete('/api/users/99999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });
});
