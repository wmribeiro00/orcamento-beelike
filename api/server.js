/* ============================================
   Bee Like Orçamento — API Server
   Backend Node.js simples com arquivos JSON
   ============================================ */

const express = require('express');
const fs      = require('fs');
const path    = require('path');
const cors    = require('cors');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

/* ---------- Caminhos dos arquivos de dados ---------- */
const DATA_DIR = path.join(__dirname, 'data');
const FILES = {
  config:   path.join(DATA_DIR, 'config.json'),
  products: path.join(DATA_DIR, 'products.json'),
  budgets:  path.join(DATA_DIR, 'budgets.json'),
};

// Garante que a pasta data existe
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Migração: adiciona id e status nos orçamentos antigos que não têm
function migrateBudgets() {
  try {
    if (!fs.existsSync(FILES.budgets)) return;
    const budgets = JSON.parse(fs.readFileSync(FILES.budgets, 'utf8'));
    let changed = false;
    budgets.forEach((b, i) => {
      if (!b.id)     { b.id     = 'b_' + (b.budgetCode || i) + '_' + i; changed = true; }
      if (!b.status) { b.status = 'pendente'; changed = true; }
    });
    if (changed) fs.writeFileSync(FILES.budgets, JSON.stringify(budgets, null, 2), 'utf8');
  } catch {}
}
migrateBudgets();

/* ---------- Utilitários ---------- */
function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

/* ---------- Rotas ---------- */

// GET /api/data — retorna config + produtos (substitui o JSONP do Apps Script)
app.get('/api/data', (req, res) => {
  const config   = readJson(FILES.config,   {});
  const products = readJson(FILES.products, {});
  res.json({ status: 'ok', config, products });
});

// POST /api/config — salva configurações da empresa
app.post('/api/config', (req, res) => {
  const config = req.body.config || req.body;
  writeJson(FILES.config, config);
  res.json({ status: 'ok' });
});

// POST /api/products — salva ou atualiza um produto (usa id como chave)
app.post('/api/products', (req, res) => {
  const p = req.body.product || req.body;
  if (!p || !p.id) {
    return res.status(400).json({ status: 'error', message: 'Campo id é obrigatório' });
  }
  const products = readJson(FILES.products, {});
  products[p.id] = p;
  writeJson(FILES.products, products);
  res.json({ status: 'ok' });
});

// DELETE /api/products/:id — remove um produto pelo id
app.delete('/api/products/:id', (req, res) => {
  const products = readJson(FILES.products, {});
  delete products[req.params.id];
  writeJson(FILES.products, products);
  res.json({ status: 'ok' });
});

// GET /api/budgets — lista todos os orçamentos
app.get('/api/budgets', (req, res) => {
  const budgets = readJson(FILES.budgets, []);
  res.json({ status: 'ok', budgets });
});

// POST /api/budgets — salva um orçamento no histórico
app.post('/api/budgets', (req, res) => {
  const budgets = readJson(FILES.budgets, []);
  const budget = {
    ...req.body,
    id: req.body.id || ('b_' + Date.now()),
    status: req.body.status || 'pendente',
    savedAt: req.body.savedAt || new Date().toISOString()
  };
  budgets.push(budget);
  writeJson(FILES.budgets, budgets);
  res.json({ status: 'ok', id: budget.id });
});

// PUT /api/budgets/:id — atualiza um orçamento (edição ou status)
app.put('/api/budgets/:id', (req, res) => {
  const budgets = readJson(FILES.budgets, []);
  const idx = budgets.findIndex(b => b.id === req.params.id);
  if (idx === -1) return res.status(404).json({ status: 'error', message: 'Orçamento não encontrado' });
  budgets[idx] = { ...budgets[idx], ...req.body, id: req.params.id, updatedAt: new Date().toISOString() };
  writeJson(FILES.budgets, budgets);
  res.json({ status: 'ok' });
});

// DELETE /api/budgets/:id — remove um orçamento
app.delete('/api/budgets/:id', (req, res) => {
  const budgets = readJson(FILES.budgets, []);
  const filtered = budgets.filter(b => b.id !== req.params.id);
  writeJson(FILES.budgets, filtered);
  res.json({ status: 'ok' });
});

// Serve o frontend estático APÓS as rotas da API (evita conflito com a pasta api/data/)
app.use(express.static(path.join(__dirname, '..')));

/* ---------- Start ---------- */
app.listen(PORT, () => {
  console.log(`Bee Like API rodando em http://localhost:${PORT}`);
  console.log(`Frontend disponível em http://localhost:${PORT}/index.html`);
});
