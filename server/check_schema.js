const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.sqlite');

console.log('=== TABLE SCHEMA ===');

db.all("PRAGMA table_info(users)", (err, columns) => {
  if (err) {
    console.error('Erro:', err);
    return;
  }
  
  columns.forEach(col => {
    console.log(`Column: ${col.name} | Type: ${col.type} | NotNull: ${col.notnull} | Default: ${col.dflt_value}`);
  });
  
  db.close();
});
