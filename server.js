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
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

// ================== OMIE ==================
app.get('/api/vendas', async (req, res) => {
  try {
    const { dataInicio, dataFim } = req.query;
    const hoje = new Date();

    const diIso =
      dataInicio ||
      dateToIso(new Date(new Date().setDate(hoje.getDate() - 6)));
    const dfIso = dataFim || dateToIso(new Date());

    const payload = {
      call: 'ObterResumoProdutos',
      app_key: process.env.OMIE_APP_KEY,
      app_secret: process.env.OMIE_APP_SECRET,
      param: [
        {
          dDataInicio: isoToBr(diIso),
          dDataFim: isoToBr(dfIso),
          lApenasResumo: true,
        },
      ],
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
      ticketMedio,
    });
  } catch (e) {
    res.status(500).json({ error: 'Erro Omie' });
  }
});

// ================== SUPABASE (METAS) ==================
app.get('/api/metas', async (req, res) => {
  try {
    const { mes } = req.query;

    if (!mes) {
      return res.status(400).json({ error: 'Parâmetro mes é obrigatório' });
    }

    const headers = {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    };

    // 1️⃣ Resultados do mês
    const resultadosResp = await axios.get(
      `${process.env.SUPABASE_URL}/rest/v1/meta_resultados` +
        `?select=id,mes,meta_id&mes=eq.${mes}`,
      { headers }
    );

    const resultados = resultadosResp.data;
    if (!resultados.length) return res.json([]);

    const resultadoIds = resultados.map(r => `"${r.id}"`).join(',');
    const metaIds = resultados.map(r => `"${r.meta_id}"`).join(',');

    // 2️⃣ Componentes
    const componentesResp = await axios.get(
      `${process.env.SUPABASE_URL}/rest/v1/meta_result_componentes` +
        `?select=id,resultado_id,metrica,alvo,realizado,percentual,faltou` +
        `&resultado_id=in.(${resultadoIds})` +
        `&order=metrica.asc`,
      { headers }
    );

    // 3️⃣ Metas
    const metasResp = await axios.get(
      `${process.env.SUPABASE_URL}/rest/v1/metas` +
        `?select=id,titulo,tipo&id=in.(${metaIds})`,
      { headers }
    );

    const metas = metasResp.data;

    // 4️⃣ Montagem final
    const resposta = componentesResp.data.map(comp => {
      const resultado = resultados.find(r => r.id === comp.resultado_id);
      const meta = metas.find(m => m.id === resultado.meta_id);

      return {
        meta_id: meta.id,
        titulo: meta.titulo,
        tipo: meta.tipo,
        mes: resultado.mes,
        metrica: comp.metrica,
        alvo: comp.alvo,
        realizado: comp.realizado,
        percentual: comp.percentual,
        faltou: comp.faltou,
      };
    });

    res.json(resposta);
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
