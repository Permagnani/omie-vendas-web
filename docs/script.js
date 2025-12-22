const API_VENDAS = 'https://omie-vendas-web-production.up.railway.app/api/vendas';
const API_METAS = 'https://omie-vendas-web-production.up.railway.app/api/metas';

// ===== UTIL =====
function formatMoney(v) {
  return `R$ ${Number(v).toFixed(2).replace('.', ',')}`;
}

// ===== RESUMO OMIE =====
async function carregarResumo() {
  const di = dataInicio.value;
  const df = dataFim.value;

  const qs = di && df ? `?dataInicio=${di}&dataFim=${df}` : '';
  const r = await fetch(API_VENDAS + qs);
  const d = await r.json();

  totalFaturado.textContent = formatMoney(d.vFaturadas);
  qtdeVendas.textContent = d.nFaturadas;
  ticketMedio.textContent = formatMoney(d.ticketMedio);
}

// ===== METAS =====
async function carregarMetas() {
  const hoje = new Date();
  const mes = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}`;

  const r = await fetch(`${API_METAS}?mes=${mes}`);
  const metas = await r.json();

  metas.slice(0,4).forEach((m,i)=>{
    const c = m.meta_resultados[0]?.meta_result_componentes[0];
    if(!c) return;

    const idx = i+1;
    const pct = Math.min(Number(c.percentual||0),100);

    document.getElementById(`meta${idx}Title`).textContent = m.titulo;
    document.getElementById(`meta${idx}Sub`).textContent = c.metrica;

    document.getElementById(`meta${idx}Atual`).textContent =
      m.tipo === 'proporcao' ? `${c.realizado}%`
      : m.tipo === 'faturamento' ? formatMoney(c.realizado)
      : c.realizado;

    document.getElementById(`meta${idx}Total`).textContent =
      m.tipo === 'proporcao' ? `${c.alvo}%`
      : m.tipo === 'faturamento' ? formatMoney(c.alvo)
      : c.alvo;

    document.getElementById(`meta${idx}Fill`).style.width = `${pct}%`;
    document.getElementById(`meta${idx}Percent`).textContent = `${Math.round(pct)}%`;

    document.getElementById(`meta${idx}Falta`).textContent =
      m.tipo === 'proporcao' ? `Faltam ${c.faltou}%`
      : m.tipo === 'faturamento' ? `Faltam ${formatMoney(c.faltou)}`
      : `Faltam ${c.faltou}`;
  });
}

// ===== FILTROS =====
function aplicarAtalho(tipo) {
  const hoje = new Date();
  let di, df;

  if (tipo === 'hoje') di = df = hoje;
  if (tipo === '7dias') { df = hoje; di = new Date(); di.setDate(di.getDate()-6); }
  if (tipo === 'mes') { di = new Date(hoje.getFullYear(), hoje.getMonth(), 1); df = hoje; }

  dataInicio.value = di.toISOString().slice(0,10);
  dataFim.value = df.toISOString().slice(0,10);

  carregarResumo();
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', ()=>{
  aplicarAtalho('7dias');
  carregarMetas();

  btnFiltrar.onclick = carregarResumo;
  document.querySelectorAll('.atalhos button').forEach(b=>{
    b.onclick = ()=>aplicarAtalho(b.dataset.range);
  });
});
