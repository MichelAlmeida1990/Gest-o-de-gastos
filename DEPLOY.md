# ExpenseFlow - Sistema de Controle de Gastos

Sistema empresarial freemium para gestão financeira com dashboard administrativo, validação robusta, filtros avançados, relatórios detalhados e notificações em tempo real.

## 🚀 Deploy no Render

### Pré-requisitos
- Conta no [Render](https://render.com/)
- Repositório no GitHub

### Passos para Deploy

1. **Backend (Web Service)**
   - Conecte seu repositório GitHub
   - Root directory: `server`
   - Build command: `npm install && npm run build`
   - Start command: `node index.js`
   - Environment Variables:
     ```
     NODE_ENV=production
     JWT_SECRET=your_jwt_secret_here
     DATABASE_URL=postgresql://user:pass@host:port/dbname
     ```

2. **Frontend (Static Site)**
   - Conecte o mesmo repositório
   - Root directory: `client`
   - Build command: `npm run build`
   - Publish directory: `build`
   - Environment Variables:
     ```
     REACT_APP_API_URL=your_backend_url_here
     ```

3. **Banco de Dados (PostgreSQL)**
   - Crie um PostgreSQL service no Render
   - Copie a DATABASE_URL para o backend

### Migração SQLite → PostgreSQL

Execute estes comandos no backend:
```bash
npm install pg
# Atualize server/index.js para usar PostgreSQL
```

### Features Implementadas

✅ Validação robusta de formulários
✅ Filtros avançados (busca, categoria, status, período)
✅ Sistema de notificações internas
✅ Relatórios avançados com exportação
✅ Dashboard administrativo completo
✅ Autenticação JWT segura
✅ Upload de comprovantes
✅ Interface responsiva com Material-UI

### Tecnologias

- **Frontend**: React 19, TypeScript, Material-UI, Recharts
- **Backend**: Node.js, Express, JWT, Multer
- **Banco**: SQLite (dev) → PostgreSQL (prod)
- **Deploy**: Render.com

## 📦 Estrutura do Projeto

```
ExpenseFlow/
├── server/          # Backend Node.js
│   ├── index.js     # API principal
│   └── package.json
├── client/          # Frontend React
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── utils/
│   │   └── context/
│   └── package.json
└── Procfile         # Config Render
```

## 🎯 Próximos Passos

1. Configurar PostgreSQL no Render
2. Atualizar backend para PostgreSQL
3. Configurar environment variables
4. Deploy backend e frontend
5. Testar integração em produção
