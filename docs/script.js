// frontend???/script.js

const API_URL = 'https://omie-vendas-web-production.up.railway.app/api/vendas';



function formatMoney(valor) {
  return `R$ ${valor.toFixed(2).replace('.', ',')}`;
}

async function carregarResumo() {
  try {
    const dataInicio = document.getElementById('dataInicio').value;
    const dataFim = document.getElementById('dataFim').value;

    const params = new URLSearchParams();
    if (dataInicio) params.append('dataInicio', dataInicio);
    if (dataFim) params.append('dataFim', dataFim);

    const url =
      params.toString().length > 0
        ? `${API_URL}?${params.toString()}`
        : API_URL;

    const resp = await fetch(url);
    const resumo = await resp.json();

    console.log('Resumo recebido da API:', resumo);

    atualizarResumo(resumo);
    atualizarTabela(resumo);
  } catch (err) {
    console.error('Erro ao carregar resumo:', err);
  }
}

function atualizarResumo(resumo) {
  const totalFaturadoElem = document.getElementById('totalFaturado');
  const qtdeVendasElem = document.getElementById('qtdeVendas');
  const ticketMedioElem = document.getElementById('ticketMedio');

  const total = Number(resumo.vFaturadas || 0);
  const qtde = Number(resumo.nFaturadas || 0);
  const ticket = Number(resumo.ticketMedio || 0);

  totalFaturadoElem.textContent = formatMoney(total);
  qtdeVendasElem.textContent = qtde;
  ticketMedioElem.textContent = formatMoney(ticket);
}

// Por enquanto a tabela mostra só uma linha agregada do período
function atualizarTabela(resumo) {
  const tbody = document.getElementById('tbodyVendas');
  tbody.innerHTML = '';

  const tr = document.createElement('tr');

  const periodo =
    (resumo.dataInicioBr || '') +
    ' a ' +
    (resumo.dataFimBr || '');

  tr.innerHTML = `
    <td>${periodo}</td>
    <td>-</td>
    <td>-</td>
    <td>Faturado</td>
    <td>${formatMoney(Number(resumo.vFaturadas || 0))}</td>
  `;

  tbody.appendChild(tr);
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
  // ao abrir, já carrega últimos 7 dias
  aplicarAtalho('7dias');

  document
    .getElementById('btnFiltrar')
    .addEventListener('click', carregarResumo);

  document
    .querySelectorAll('.atalhos button')
    .forEach((btn) => {
      btn.addEventListener('click', () => {
        const range = btn.getAttribute('data-range');
        aplicarAtalho(range);
      });
    });
});
