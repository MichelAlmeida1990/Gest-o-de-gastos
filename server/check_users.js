const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.sqlite');

console.log('=== USUÁRIOS CADASTRADOS ===');

db.all('SELECT * FROM users', (err, rows) => {
  if (err) {
    console.error('Erro:', err);
    return;
  }
  
  if (rows.length === 0) {
    console.log('Nenhum usuário encontrado no banco de dados.');
  } else {
    rows.forEach(user => {
      console.log(`ID: ${user.id}`);
      console.log(`Nome: ${user.name}`);
      console.log(`Email: ${user.email}`);
      console.log(`Função: ${user.role}`);
      console.log(`Plano: ${user.plan}`);
      console.log(`Departamento: ${user.department || 'N/A'}`);
      console.log(`Cargo: ${user.position || 'N/A'}`);
      console.log(`Criado em: ${user.created_at}`);
      console.log('---');
    });
  }
  
  db.close();
});
