const API_VENDAS = 'https://omie-vendas-web-production.up.railway.app/api/vendas';
const API_METAS = 'https://omie-vendas-web-production.up.railway.app/api/metas';

// ===== DATA =====
function getMesAtualISO() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  return `${ano}-${mes}-01`;
}

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

// ===== RESUMO =====
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
  const mesAtual = getMesAtualISO();

  const r = await fetch(`${API_METAS}?mes=${mesAtual}`);
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

    document.getElementById(`meta${i}Title`).textContent =
      tipo.replaceAll('_', ' ').toLowerCase()
        .replace(/(^|\s)\S/g, l => l.toUpperCase());

    document.getElementById(`meta${i}Sub`).textContent =
      `Meta mensal — ${formatarMesAno(mesAtual)}`;

    const atualEl = document.getElementById(`meta${i}Atual`);
    const totalEl = document.getElementById(`meta${i}Total`);
    const faltaEl = document.getElementById(`meta${i}Falta`);
    const percentEl = document.getElementById(`meta${i}Percent`);
    const fillEl = document.getElementById(`meta${i}Fill`);
    const barEl = fillEl?.parentElement;

    // === PROPORÇÃO ===
    if (tipo === 'CANA_ENREDO_PROPORCAO') {
      if (barEl) barEl.style.display = 'none';
      atualEl.textContent = `${meta.realizado}%`;
      totalEl.textContent = `${meta.meta_valor}%`;
      percentEl.style.display = 'none';
      faltaEl.style.display = 'none';
      return;
    }

    // === METAS NORMAIS ===
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
    percentEl.textContent = `${pct.toFixed(2)}%`;

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
  aplicarAtalho('hoje');
  carregarResumo();
  carregarMetas();

  btnFiltrar.onclick = carregarResumo;
  document.querySelectorAll('.atalhos button').forEach(b => {
    b.onclick = () => aplicarAtalho(b.dataset.range);
  });
});
