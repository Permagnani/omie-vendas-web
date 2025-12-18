// docs/script.js

// Base do Railway
const API_BASE = 'https://omie-vendas-web-production.up.railway.app';
const API_VENDAS = `${API_BASE}/api/vendas`;
const API_METAS = `${API_BASE}/api/metas`;

function formatMoney(valor) {
  const v = Number(valor || 0);
  return `R$ ${v.toFixed(2).replace('.', ',')}`;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function setText(id, txt) {
  const el = document.getElementById(id);
  if (el) el.textContent = txt;
}

function setWidth(id, pct) {
  const el = document.getElementById(id);
  if (el) el.style.width = `${pct}%`;
}

function formatValorPorMetrica(metrica, valor) {
  if (metrica === 'PERCENTUAL') {
    return `${(Number(valor || 0) * 100).toFixed(1)}%`;
  }
  if (metrica === 'QTD') {
    const v = Number(valor || 0);
    return Number.isInteger(v) ? String(v) : v.toFixed(2).replace('.', ',');
  }
  return formatMoney(Number(valor || 0));
}

function formatFaltouPorMetrica(metrica, faltou) {
  if (metrica === 'PERCENTUAL') {
    return `Faltam ${(Number(faltou || 0) * 100).toFixed(1)} p.p.`;
  }
  if (metrica === 'QTD') {
    const v = Number(faltou || 0);
    return v <= 0
      ? 'Meta atingida'
      : `Faltam ${Number.isInteger(v) ? v : v.toFixed(2).replace('.', ',')}`;
  }
  return Number(faltou || 0) <= 0
    ? 'Meta atingida'
    : `Faltam ${formatMoney(Number(faltou || 0))}`;
}

// Troca as imagens dos personagens conforme a %
// Você vai criar esses arquivos depois.
function pickStatusImgs(percentual) {
  if (percentual >= 80) return { p1: 'assets/meta/p1_alto.png', p2: 'assets/meta/p2_alto.png' };
  if (percentual >= 40) return { p1: 'assets/meta/p1_meio.png', p2: 'assets/meta/p2_meio.png' };
  return { p1: 'assets/meta/p1_baixo.png', p2: 'assets/meta/p2_baixo.png' };
}

function setImgs(metaIndex, percentual) {
  const imgs = pickStatusImgs(percentual);
  const fig1 = document.getElementById(`meta${metaIndex}Fig1`);
  const fig2 = document.getElementById(`meta${metaIndex}Fig2`);
  if (fig1) fig1.src = imgs.p1;
  if (fig2) fig2.src = imgs.p2;
}

async function carregarResumo() {
  try {
    const dataInicio = document.getElementById('dataInicio').value;
    const dataFim = document.getElementById('dataFim').value;

    const params = new URLSearchParams();
    if (dataInicio) params.append('dataInicio', dataInicio);
    if (dataFim) params.append('dataFim', dataFim);

    const urlVendas =
      params.toString().length > 0
        ? `${API_VENDAS}?${params.toString()}`
        : API_VENDAS;

    const resp = await fetch(urlVendas);
    const resumo = await resp.json();

    console.log('Resumo recebido da API:', resumo);

    atualizarResumo(resumo);
    atualizarTabela(resumo);

    await carregarMetas(dataInicio, dataFim);
  } catch (err) {
    console.error('Erro ao carregar resumo:', err);
  }
}

function atualizarResumo(resumo) {
  setText('totalFaturado', formatMoney(Number(resumo.vFaturadas || 0)));
  setText('qtdeVendas', String(Number(resumo.nFaturadas || 0)));
  setText('ticketMedio', formatMoney(Number(resumo.ticketMedio || 0)));
}

function atualizarTabela(resumo) {
  const tbody = document.getElementById('tbodyVendas');
  if (!tbody) return;

  tbody.innerHTML = '';

  const tr = document.createElement('tr');
  const periodo = (resumo.dataInicioBr || '') + ' a ' + (resumo.dataFimBr || '');

  tr.innerHTML = `
    <td>${periodo}</td>
    <td>-</td>
    <td>-</td>
    <td>Faturado</td>
    <td>${formatMoney(Number(resumo.vFaturadas || 0))}</td>
  `;

  tbody.appendChild(tr);
}

async function carregarMetas(dataInicio, dataFim) {
  try {
    const params = new URLSearchParams();
    if (dataInicio) params.append('dataInicio', dataInicio);
    if (dataFim) params.append('dataFim', dataFim);

    const urlMetas =
      params.toString().length > 0
        ? `${API_METAS}?${params.toString()}`
        : API_METAS;

    const resp = await fetch(urlMetas);
    const payload = await resp.json();

    console.log('Metas recebidas da API:', payload);

    if (payload?.error) {
      renderMetasErro(payload.error);
      return;
    }

    renderMetas(payload.metas || [], payload.aviso || null);
  } catch (err) {
    console.error('Erro ao carregar metas:', err);
    renderMetasErro('Erro ao carregar metas. Veja o console para detalhes.');
  }
}

function renderMetasErro(msg) {
  // coloca o erro na Meta 1 para ficar visível
  setText('meta1Title', 'Metas');
  setText('meta1Sub', msg);

  // zera barras para não confundir
  for (let i = 1; i <= 4; i++) {
    setText(`meta${i}Atual`, '—');
    setText(`meta${i}Total`, '—');
    setText(`meta${i}Percent`, '0%');
    setText(`meta${i}Falta`, '—');
    setWidth(`meta${i}Fill`, 0);
    setImgs(i, 0);
  }
}

function renderMetas(metas, aviso) {
  const ordem = ['FATURAMENTO_TOTAL', 'ENREDO_SHARE', 'COOKIES', 'AGUAS'];
  const ordenadas = [...(metas || [])].sort((a, b) => ordem.indexOf(a.tipo) - ordem.indexOf(b.tipo));

  if (aviso) {
    // mostra o aviso no subtítulo da primeira meta (pode mudar depois)
    setText('meta1Sub', aviso);
  }

  // Preenche 4 slots fixos (meta1..meta4)
  for (let i = 1; i <= 4; i++) {
    const meta = ordenadas[i - 1];

    if (!meta) {
      setText(`meta${i}Title`, `Meta ${i}`);
      setText(`meta${i}Sub`, 'Sem meta cadastrada para este mês');
      setText(`meta${i}Atual`, '—');
      setText(`meta${i}Total`, '—');
      setText(`meta${i}Percent`, '0%');
      setText(`meta${i}Falta`, '—');
      setWidth(`meta${i}Fill`, 0);
      setImgs(i, 0);
      continue;
    }

    const c = meta.componentes?.[0] || null;

    setText(`meta${i}Title`, meta.titulo || meta.tipo);

    // subtítulo padrão por tipo
    const subtituloPorTipo = {
      FATURAMENTO_TOTAL: 'Faturamento total do período',
      ENREDO_SHARE: 'Participação do Enredo no faturamento',
      COOKIES: 'Quantidade de Cookies vendidos',
      AGUAS: 'Quantidade de Águas vendidas',
    };
    setText(`meta${i}Sub`, subtituloPorTipo[meta.tipo] || '');

    if (!c) {
      setText(`meta${i}Atual`, '—');
      setText(`meta${i}Total`, '—');
      setText(`meta${i}Percent`, '0%');
      setText(`meta${i}Falta`, '—');
      setWidth(`meta${i}Fill`, 0);
      setImgs(i, 0);
      continue;
    }

    const percentual = clamp(Number(c.percentual || 0), 0, 999);
    const pctBarra = clamp(percentual, 0, 100);

    setText(`meta${i}Atual`, formatValorPorMetrica(c.metrica, c.realizado));
    setText(`meta${i}Total`, formatValorPorMetrica(c.metrica, c.alvo));
    setWidth(`meta${i}Fill`, pctBarra);
    setText(`meta${i}Percent`, `${percentual.toFixed(0)}%`);
    setText(`meta${i}Falta`, c.atingiu ? 'Meta atingida' : formatFaltouPorMetrica(c.metrica, c.faltou));

    setImgs(i, percentual);
  }
}

function aplicarAtalho(tipo) {
  const hoje = new Date();
  let di, df;

  if (tipo === 'hoje') {
    di = new Date(hoje);
    df = new Date(hoje);
  } else if (tipo === '7dias') {
    df = new Date(hoje);
    di = new Date(hoje);
    di.setDate(di.getDate() - 6);
  } else if (tipo === 'mes') {
    di = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    df = new Date(hoje);
  } else {
    di = new Date(hoje);
    df = new Date(hoje);
  }

  const toIso = (d) => d.toISOString().slice(0, 10);

  document.getElementById('dataInicio').value = toIso(di);
  document.getElementById('dataFim').value = toIso(df);

  carregarResumo();
}

document.addEventListener('DOMContentLoaded', () => {
  aplicarAtalho('7dias');

  document.getElementById('btnFiltrar').addEventListener('click', carregarResumo);

  document.querySelectorAll('.atalhos button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const range = btn.getAttribute('data-range');
      aplicarAtalho(range);
    });
  });
});

