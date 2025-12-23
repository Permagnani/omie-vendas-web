const API_VENDAS = 'https://omie-vendas-web-production.up.railway.app/api/vendas';
const API_METAS = 'https://omie-vendas-web-production.up.railway.app/api/metas';

// ===== UTIL =====
function formatMoney(v) {
  return `R$ ${Number(v).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatarMesAno(dataIso) {
  const d = new Date(dataIso);
  return d
    .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    .replace(/^\w/, c => c.toUpperCase());
}

// ===== RESUMO OMIE =====
async function carregarResumo() {
  const di = dataInicio.value;
  const df = dataFim.value;

  const qs = di && df ? `?dataInicio=${di}&dataFim=${df}` : '';
  const r = await fetch(API_VENDAS + qs);
  const d = await r.json();

  totalFaturado.textContent = formatMoney(d.vFaturadas || 0);
  qtdeVendas.textContent = d.nFaturadas || 0;
  ticketMedio.textContent = formatMoney(d.ticketMedio || 0);
}

// ===== METAS =====
async function carregarMetas() {
  const hoje = new Date();
  const mes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`;

  const r = await fetch(`${API_METAS}?mes=${mes}`);
  const metas = await r.json();
  if (!Array.isArray(metas)) return;

  const ordem = [
    'FATURAMENTO_TOTAL',
    'CANA_ENREDO_PROPORCAO',
    'COOKIES_VENDIDOS',
    'AGUAS_VENDIDAS',
  ];

  ordem.forEach((tipo, index) => {
    const meta = metas.find(m => m.tipo === tipo);
    if (!meta) return;

    const i = index + 1;
    const pct = Math.min(Number(meta.percentual || 0), 100);

    // Título
    document.getElementById(`meta${i}Title`).textContent =
      tipo.replaceAll('_', ' ').toLowerCase()
        .replace(/(^|\s)\S/g, l => l.toUpperCase());

    document.getElementById(`meta${i}Sub`).textContent =
    'Meta mensal — Dezembro de 2025';


    const atualEl = document.getElementById(`meta${i}Atual`);
    const totalEl = document.getElementById(`meta${i}Total`);
    const faltaEl = document.getElementById(`meta${i}Falta`);
    const percentEl = document.getElementById(`meta${i}Percent`);
    const fillEl = document.getElementById(`meta${i}Fill`);
    const barEl = fillEl?.parentElement;

   // ===== CASO ESPECIAL: PROPORÇÃO CANA ENREDO =====
if (tipo === 'CANA_ENREDO_PROPORCAO') {
  // Esconde barra
  if (barEl) barEl.style.display = 'none';

  // Atual e Meta
  atualEl.textContent = `${meta.realizado}%`;
  totalEl.textContent = `${meta.meta_valor}%`;

  // ESCONDER completamente o que não deve aparecer
  percentEl.textContent = '';
  percentEl.style.display = 'none';

  faltaEl.textContent = '';
  faltaEl.style.display = 'none';

  return;
}


    // ===== METAS NORMAIS =====
    if (barEl) barEl.style.display = 'block';

    atualEl.textContent =
      tipo === 'FATURAMENTO_TOTAL'
        ? formatMoney(meta.realizado)
        : meta.realizado;

    totalEl.textContent =
      tipo === 'FATURAMENTO_TOTAL'
        ? formatMoney(meta.meta_valor)
        : meta.meta_valor;

    fillEl.style.width = `${pct}%`;
    percentEl.textContent = `${pct(2)}%`;

    faltaEl.textContent =
      tipo === 'FATURAMENTO_TOTAL'
        ? `Faltam ${formatMoney(meta.faltou)}`
        : `Faltam ${meta.faltou}`;
  });
}

// ===== FILTROS =====
function aplicarAtalho(tipo) {
  const hoje = new Date();
  let di, df;

  if (tipo === 'hoje') di = df = hoje;
  if (tipo === '7dias') {
    df = hoje;
    di = new Date();
    di.setDate(di.getDate() - 6);
  }
  if (tipo === 'mes') {
    di = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    df = hoje;
  }

  dataInicio.value = di.toISOString().slice(0, 10);
  dataFim.value = df.toISOString().slice(0, 10);

  carregarResumo();
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  aplicarAtalho('7dias');
  carregarMetas();

  btnFiltrar.onclick = carregarResumo;
  document.querySelectorAll('.atalhos button').forEach(b => {
    b.onclick = () => aplicarAtalho(b.dataset.range);
  });
});
