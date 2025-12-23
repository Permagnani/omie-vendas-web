// backend/server.js
const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ================== UTIL ==================
function isoToBr(dateStr) {
  if (!dateStr) return '';
  const [ano, mes, dia] = dateStr.split('-');
  return `${dia}/${mes}/${ano}`;
}

function dateToIso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ================== OMIE ==================
app.get('/api/vendas', async (req, res) => {
  try {
    const { dataInicio, dataFim } = req.query;
    const hoje = new Date();

    const diIso = dataInicio || dateToIso(new Date(hoje.setDate(hoje.getDate() - 6)));
    const dfIso = dataFim || dateToIso(new Date());

    const payload = {
      call: 'ObterResumoProdutos',
      app_key: process.env.OMIE_APP_KEY,
      app_secret: process.env.OMIE_APP_SECRET,
      param: [{
        dDataInicio: isoToBr(diIso),
        dDataFim: isoToBr(dfIso),
        lApenasResumo: true
      }]
    };

    const { data } = await axios.post(
      'https://app.omie.com.br/api/v1/produtos/vendas-resumo/',
      payload
    );

    const fr = data.faturamentoResumo || {};
    const nFaturadas = Number(fr.nFaturadas || 0);
    const vFaturadas = Number(fr.vFaturadas || 0);
    const ticketMedio = nFaturadas ? vFaturadas / nFaturadas : 0;

    res.json({
      dataInicioIso: diIso,
      dataFimIso: dfIso,
      nFaturadas,
      vFaturadas,
      ticketMedio
    });
  } catch (e) {
    res.status(500).json({ error: 'Erro Omie' });
  }
});

// ================== SUPABASE (METAS) ==================
app.get('/api/metas', async (req, res) => {
  try {
    const { mes } = req.query;

    /**
     * SCHEMA CORRETO:
     * meta_result_componentes
     *  -> resultado_id -> meta_resultados.id
     * meta_resultados
     *  -> meta_id -> metas.id
     */

    const url =
      `${process.env.SUPABASE_URL}/rest/v1/meta_result_componentes` +
      `?select=
        id,
        metrica,
        alvo,
        realizado,
        percentual,
        faltou,
        meta_resultados(
          id,
          mes,
          metas(
            id,
            titulo,
            tipo
          )
        )
      ` +
      (mes ? `&meta_resultados.mes=eq.${mes}` : '');

    const { data } = await axios.get(url, {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });

    res.json(data);
  } catch (e) {
    res.status(500).json({
      error: 'Erro Supabase',
      detalhe: e.response?.data || e.message,
    });
  }
});

// ================== START ==================
app.listen(PORT, () => {
  console.log(`API rodando na porta ${PORT}`);
});
