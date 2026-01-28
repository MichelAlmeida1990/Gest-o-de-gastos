// Configuração global para testes
beforeAll(async () => {
  // Configurar ambiente de teste
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret';
});

afterAll(async () => {
  // Limpeza após todos os testes
});

beforeEach(async () => {
  // Limpeza antes de cada teste
});
