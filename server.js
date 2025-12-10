// backend/server.js
const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Converte yyyy-mm-dd -> dd/mm/yyyy
function isoToBr(dateStr) {
  if (!dateStr) return '';
  const [ano, mes, dia] = dateStr.split('-');
  return `${dia}/${mes}/${ano}`;
}

// Converte Date para yyyy-mm-dd
function dateToIso(d) {
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

/**
 * Rota /api/vendas
 * Lê dataInicio e dataFim (yyyy-mm-dd) da query string.
 * Se não vier nada, usa últimos 7 dias.
 * Chama ObterResumoProdutos na Omie e devolve:
 *  - nFaturadas
 *  - vFaturadas
 *  - ticketMedio
 */
app.get('/api/vendas', async (req, res) => {
  try {
    const { dataInicio, dataFim } = req.query;

    const hoje = new Date();
    let diIso, dfIso;

    if (dataInicio && dataFim) {
      diIso = dataInicio;
      dfIso = dataFim;
    } else {
      // padrão: últimos 7 dias
      const df = new Date(hoje);
      const di = new Date(hoje);
      di.setDate(di.getDate() - 6);
      diIso = dateToIso(di);
      dfIso = dateToIso(df);
    }

    const diBr = isoToBr(diIso); // dd/mm/aaaa para Omie
    const dfBr = isoToBr(dfIso);

    const payload = {
      call: 'ObterResumoProdutos',
      app_key: process.env.OMIE_APP_KEY,
      app_secret: process.env.OMIE_APP_SECRET,
      param: [
        {
          dDataInicio: diBr,
          dDataFim: dfBr,
          lApenasResumo: true,
        },
      ],
    };

    const { data } = await axios.post(
      'https://app.omie.com.br/api/v1/produtos/vendas-resumo/',
      payload
    );

    const fr = data.faturamentoResumo || {};

    const nFaturadas = fr.nFaturadas || 0;
    const vFaturadasNum = Number(fr.vFaturadas || 0);
    const ticketMedio =
      nFaturadas > 0 ? vFaturadasNum / nFaturadas : 0;

    res.json({
      dataInicioIso: diIso,
      dataFimIso: dfIso,
      dataInicioBr: diBr,
      dataFimBr: dfBr,
      nFaturadas,
      vFaturadas: vFaturadasNum,
      ticketMedio,
      bruto: fr, // se quiser inspecionar depois
    });
  } catch (error) {
    console.error('Erro Omie:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error(
        'Dados:',
        JSON.stringify(error.response.data, null, 2)
      );
    } else {
      console.error('Mensagem:', error.message);
    }
    res
      .status(500)
      .json({ error: 'Erro ao consultar resumo de vendas na Omie' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Acesse: http://localhost:${PORT}/api/vendas`);
});
