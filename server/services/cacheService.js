const NodeCache = require('node-cache');

// Configuração do cache
const cache = new NodeCache({
  stdTTL: 300, // Tempo padrão de 5 minutos
  checkperiod: 60, // Verificar itens expirados a cada 60 segundos
  useClones: false // Melhor performance para objetos grandes
});

// Chaves de cache
const CACHE_KEYS = {
  DASHBOARD_METRICS: 'dashboard_metrics',
  USER_LIST: 'user_list',
  EXPENSE_LIST: 'expense_list',
  CATEGORY_LIST: 'category_list',
  DEPARTMENT_STATS: 'department_stats',
  USER_EXPENSES: (userId) => `user_expenses_${userId}`,
  EXPENSE_LIMITS: 'expense_limits'
};

// Função para obter dados do cache ou executar callback
const getOrSet = async (key, callback, ttl = 300) => {
  const cachedValue = cache.get(key);
  
  if (cachedValue !== undefined) {
    console.log(`Cache hit para chave: ${key}`);
    return cachedValue;
  }
  
  console.log(`Cache miss para chave: ${key}, executando callback`);
  const value = await callback();
  cache.set(key, value, ttl);
  return value;
};

// Função para invalidar cache específico
const invalidate = (key) => {
  cache.del(key);
  console.log(`Cache invalidado para chave: ${key}`);
};

// Função para invalidar múltiplas chaves
const invalidateMultiple = (keys) => {
  cache.del(keys);
  console.log(`Cache invalidado para chaves: ${keys.join(', ')}`);
};

// Função para invalidar cache por padrão
const invalidatePattern = (pattern) => {
  const keys = cache.keys();
  const matchingKeys = keys.filter(key => key.includes(pattern));
  
  if (matchingKeys.length > 0) {
    cache.del(matchingKeys);
    console.log(`Cache invalidado para padrão "${pattern}": ${matchingKeys.join(', ')}`);
  }
};

// Função para limpar todo o cache
const clear = () => {
  cache.flushAll();
  console.log('Cache completamente limpo');
};

// Função para obter estatísticas do cache
const getStats = () => {
  const stats = cache.getStats();
  return {
    keys: stats.keys,
    hits: stats.hits,
    misses: stats.misses,
    hitRate: stats.hits > 0 ? ((stats.hits / (stats.hits + stats.misses)) * 100).toFixed(2) + '%' : '0%',
    ksize: stats.ksize,
    vsize: stats.vsize
  };
};

// Função para obter todas as chaves do cache
const getKeys = () => {
  return cache.keys();
};

// Middleware para cache de respostas HTTP
const cacheMiddleware = (key, ttl = 300) => {
  return (req, res, next) => {
    const cacheKey = typeof key === 'function' ? key(req) : key;
    const cachedResponse = cache.get(cacheKey);
    
    if (cachedResponse) {
      console.log(`Respondendo do cache para: ${cacheKey}`);
      return res.json(cachedResponse);
    }
    
    // Sobrescrever res.json para interceptar a resposta
    const originalJson = res.json;
    res.json = function(data) {
      cache.set(cacheKey, data, ttl);
      console.log(`Resposta cacheada para: ${cacheKey}`);
      return originalJson.call(this, data);
    };
    
    next();
  };
};

// Função para cache de consultas ao banco de dados
const cacheQuery = (db, query, params = [], key, ttl = 300) => {
  return new Promise((resolve, reject) => {
    // Tentar obter do cache primeiro
    const cached = cache.get(key);
    if (cached !== undefined) {
      console.log(`Query cache hit para: ${key}`);
      return resolve(cached);
    }
    
    // Executar query no banco
    db.all(query, params, (err, rows) => {
      if (err) {
        console.error(`Erro na query cacheada: ${err.message}`);
        return reject(err);
      }
      
      // Armazenar no cache
      cache.set(key, rows, ttl);
      console.log(`Query cacheada para: ${key}`);
      resolve(rows);
    });
  });
};

// Função para cache de query única (get)
const cacheGet = (db, query, params = [], key, ttl = 300) => {
  return new Promise((resolve, reject) => {
    // Tentar obter do cache primeiro
    const cached = cache.get(key);
    if (cached !== undefined) {
      console.log(`Query cache hit para: ${key}`);
      return resolve(cached);
    }
    
    // Executar query no banco
    db.get(query, params, (err, row) => {
      if (err) {
        console.error(`Erro na query cacheada: ${err.message}`);
        return reject(err);
      }
      
      // Armazenar no cache
      cache.set(key, row, ttl);
      console.log(`Query cacheada para: ${key}`);
      resolve(row);
    });
  });
};

module.exports = {
  CACHE_KEYS,
  getOrSet,
  invalidate,
  invalidateMultiple,
  invalidatePattern,
  clear,
  getStats,
  getKeys,
  cacheMiddleware,
  cacheQuery,
  cacheGet
};
