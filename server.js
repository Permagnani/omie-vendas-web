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

// ================== OMIE (RESUMO) ==================
async function obterFaturamentoOmie(mes) {
  try {
    const inicioMes = `${mes.slice(0, 7)}-01`;
    const fim = new Date(mes);
    fim.setMonth(fim.getMonth() + 1);
    fim.setDate(0);

    const payload = {
      call: 'ObterResumoProdutos',
      app_key: process.env.OMIE_APP_KEY,
      app_secret: process.env.OMIE_APP_SECRET,
      param: [
        {
          dDataInicio: isoToBr(inicioMes),
          dDataFim: isoToBr(dateToIso(fim)),
          lApenasResumo: true,
        },
      ],
    };

    const { data } = await axios.post(
      'https://app.omie.com.br/api/v1/produtos/vendas-resumo/',
      payload
    );

    return Number(data?.faturamentoResumo?.vFaturadas || 0);
  } catch (err) {
    console.error('Erro Omie faturamento:', err.message);
    return 0;
  }
}

// ================== HEALTH CHECK (IMPORTANTE) ==================
app.get('/', (req, res) => {
  res.json({ status: 'API OK' });
});

// ================== VENDAS ==================
app.get('/api/vendas', async (req, res) => {
  try {
    const { dataInicio, dataFim } = req.query;
    const hoje = new Date();

    const diIso =
      dataInicio || dateToIso(new Date(new Date().setDate(hoje.getDate() - 6)));
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

    const fr = data?.faturamentoResumo || {};
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
  } catch (err) {
    console.error('Erro vendas:', err.message);
    res.status(500).json({ error: 'Erro Omie' });
  }
});

// ================== METAS ==================
app.get('/api/metas', async (req, res) => {
  try {
    const { mes } = req.query;

    if (!mes) {
      return res
        .status(400)
        .json({ error: 'Parâmetro mes é obrigatório (YYYY-MM-01)' });
    }

    const url =
      `${process.env.SUPABASE_URL}/rest/v1/metas_mensais` +
      `?select=mes,tipo,meta_valor,realizado,percentual,faltou` +
      `&mes=eq.${mes}` +
      `&order=tipo.asc`;

    const { data: metas } = await axios.get(url, {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });

    const faturamentoRealizado = await obterFaturamentoOmie(mes);

    const metasAjustadas = (metas || []).map((meta) => {
      if (meta.tipo === 'FATURAMENTO_TOTAL') {
        const realizado = faturamentoRealizado;
        const percentual =
          meta.meta_valor > 0
            ? Math.min((realizado / meta.meta_valor) * 100, 100)
            : 0;

        return {
          ...meta,
          realizado,
          percentual,
          faltou: Math.max(meta.meta_valor - realizado, 0),
        };
      }

      return meta;
    });

    res.json(metasAjustadas);
  } catch (err) {
    console.error('Erro metas:', err.message);
    res.status(500).json({
      error: 'Erro Supabase',
      detalhe: err.response?.data || err.message,
    });
  }
});

// ================== START ==================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`API rodando na porta ${PORT}`);
});
