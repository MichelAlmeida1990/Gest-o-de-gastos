# ExpenseFlow - Sistema de Controle de Gastos

Um sistema robusto de controle de gastos empresariais com modelo freemium, inspirado no Expensify.

## 🚀 Features

### Para Administradores
- **Gestão de Funcionários**: Cadastre e gerencie usuários
- **Controle de Despesas**: Adicione despesas em nome dos funcionários
- **Upload de Comprovantes**: Anexe arquivos de comprovantes (PDF, imagens)
- **Sistema de Aprovação**: Aprove ou rejeite despesas
- **Dashboard Completo**: Visualize estatísticas e relatórios
- **Categorização**: Organize despesas por categorias
- **Exportação de Relatórios**: Gere relatórios em PDF e Excel
- **Business Intelligence**: Análises avançadas e métricas
- **Gestão de Tags**: Sistema de tags para organização
- **Alertas**: Sistema de notificações e alertas

### Para Funcionários
- **Visualização de Despesas**: Veja todas as despesas registradas em seu nome
- **Acompanhamento de Status**: Monitore aprovações e rejeições
- **Detalhes**: Acesse informações completas e comprovantes
- **Estatísticas Pessoais**: Visualize seus gastos e médias

### Modelo Freemium
- **Plano Free**: Até 25 despesas/mês
- **Plano Premium**: Despesas ilimitadas
- **Controle de Limites**: Sistema automático de verificação

## 🛠️ Stack Tecnológico

### Backend (Node.js)
- **Express.js**: Framework web
- **SQLite**: Banco de dados leve
- **JWT**: Autenticação
- **Multer**: Upload de arquivos
- **bcryptjs**: Hash de senhas
- **Socket.io**: Comunicação em tempo real
- **jsPDF**: Geração de PDF
- **ExcelJS**: Geração de planilhas Excel

### Frontend (React + TypeScript)
- **React**: Interface interativa
- **TypeScript**: Tipagem segura
- **React Router**: Navegação
- **Axios**: Requisições HTTP
- **Material-UI**: Componentes visuais
- **Recharts**: Gráficos e visualizações
- **React Hot Toast**: Notificações

## 📋 Instalação

### Pré-requisitos
- Node.js (v14 ou superior)
- npm ou yarn

### Passos

1. **Clone o repositório**
   ```bash
   git clone <repository-url>
   cd controle-de-gastos
   ```

2. **Instale dependências do servidor**
   ```bash
   cd server
   npm install
   ```

3. **Instale dependências do cliente**
   ```bash
   cd ../client
   npm install
   ```

4. **Configure as variáveis de ambiente**
   ```bash
   # No diretório server
   cp .env.example .env
   # Edite o .env com suas configurações
   ```

5. **Inicie o servidor**
   ```bash
   # No diretório server
   npm run dev
   ```

6. **Inicie o cliente**
   ```bash
   # No diretório client
   npm start
   ```

## 🔧 Configuração

### Variáveis de Ambiente (server/.env)
```env
JWT_SECRET=suasenha secreta aqui
PORT=5000
```

### Acesso Padrão
- **Email**: admin@expenseflow.com
- **Senha**: admin123
- **Função**: Administrador

## 📊 Estrutura do Projeto

```
controle-de-gastos/
├── server/
│   ├── index.js          # Servidor principal
│   ├── package.json      # Dependências do backend
│   ├── .env             # Variáveis de ambiente
│   ├── services/         # Serviços do backend
│   │   └── reportService.js # Geração de relatórios
│   ├── tests/           # Testes automatizados
│   ├── docs/            # Documentação da API
│   └── uploads/         # Arquivos de comprovantes
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Login.tsx
│   │   │   ├── AdminDashboard.tsx
│   │   │   ├── EmployeeDashboard.tsx
│   │   │   ├── ReportExport.tsx
│   │   │   ├── BusinessIntelligence.tsx
│   │   │   ├── FinancialDashboard.tsx
│   │   │   ├── BudgetManagement.tsx
│   │   │   ├── TagManagement.tsx
│   │   │   └── AlertManagement.tsx
│   │   └── App.tsx
│   └── package.json      # Dependências do frontend
└── README.md
```

## 🎯 Como Usar

### Para Administradores

1. **Faça login** com as credenciais de admin
2. **Adicione funcionários** no painel administrativo
3. **Registre despesas** em nome dos funcionários
4. **Anexe comprovantes** quando necessário
5. **Aprove ou rejeite** despesas pendentes
6. **Monitore estatísticas** no dashboard
7. **Gere relatórios** em PDF ou Excel
8. **Configure tags** para melhor organização
9. **Configure alertas** para notificações

### Para Funcionários

1. **Faça login** com suas credenciais
2. **Visualize suas despesas** no painel
3. **Acompanhe o status** de aprovação
4. **Acesse detalhes** e comprovantes

## 📚 Documentação da API

### Swagger UI
Acesse a documentação interativa da API em:
```
http://localhost:5000/api-docs
```

### Endpoints Principais

#### Autenticação
- `POST /api/auth/login` - Realizar login
- `GET /api/auth/me` - Obter dados do usuário logado

#### Usuários
- `GET /api/users` - Listar usuários (admin)
- `POST /api/users` - Criar usuário (admin)
- `PUT /api/users/:id` - Atualizar usuário (admin)
- `DELETE /api/users/:id` - Deletar usuário (admin)

#### Despesas
- `GET /api/expenses` - Listar despesas
- `POST /api/expenses` - Criar despesa (admin)
- `PUT /api/expenses/:id/status` - Atualizar status (admin)

#### Relatórios
- `GET /api/reports/expenses/:format` - Gerar relatório de despesas
- `GET /api/reports/departments/:format` - Gerar relatório de departamentos

#### Dashboard
- `GET /api/dashboard` - Obter métricas do dashboard

## 🧪 Testes

### Executar Testes
```bash
# No diretório server
npm test                    # Executar todos os testes
npm run test:watch         # Executar em modo watch
npm run test:coverage      # Executar com cobertura
```

### Estrutura dos Testes
- **Autenticação**: Testes de login e validação de tokens
- **Usuários**: CRUD de usuários e validações
- **Despesas**: CRUD de despesas e aprovações
- **Relatórios**: Geração de PDF e Excel

## 🔐 Segurança

- **Senhas hashadas** com bcryptjs
- **Tokens JWT** para autenticação
- **Validação de acesso** por função
- **Upload seguro** de arquivos
- **Validação de inputs** e sanitização
- **Rate limiting** (em implementação)

## 🚀 Desenvolvimento

### Scripts Úteis

```bash
# Desenvolvimento (ambos os serviços)
npm run dev

# Apenas servidor
npm run server

# Apenas cliente
npm run client

# Build para produção
npm run build

# Testes
npm test
npm run test:coverage
```

### Funcionalidades Implementadas

- ✅ Sistema completo de autenticação
- ✅ Gestão de usuários e despesas
- ✅ Upload de arquivos
- ✅ Dashboard com estatísticas
- ✅ Exportação de relatórios (PDF/Excel)
- ✅ Business Intelligence
- ✅ Sistema de tags
- ✅ Gestão de orçamentos
- ✅ Sistema de alertas
- ✅ Testes automatizados
- ✅ Documentação da API

### Funcionalidades Futuras

- [ ] Sistema OCR para leitura automática de recibos
- [ ] Integração com sistemas contábeis
- [ ] Notificações por email
- [ ] Aplicativo mobile
- [ ] Cartões corporativos virtuais
- [ ] Rate limiting avançado
- [ ] Cache de consultas
- [ ] Sistema de auditoria

## 📝 Licença

MIT License - veja o arquivo LICENSE para detalhes

## 🤝 Contribuição

Contribuições são bem-vindas! Por favor:

1. Fork o projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

## 📞 Suporte

Para suporte, envie um email para support@expenseflow.com ou abra uma issue no GitHub.
