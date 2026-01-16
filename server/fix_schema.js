const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.sqlite');

console.log('Adding expense_limit column...');

db.run('ALTER TABLE users ADD COLUMN expense_limit REAL DEFAULT 0', (err) => {
  if (err) {
    console.error('Error adding column:', err);
  } else {
    console.log('Column expense_limit added successfully!');
  }
  
  db.close();
});
