// backend/server.js
const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

/**
 * Converte data da Omie no formato dd/mm/aaaa para yyyy-mm-dd
 * para manter compatível com o front (new Date(...)).
 */
function brToIso(dateStr) {
  if (!dateStr) return '';
  const [dia, mes, ano] = dateStr.split('/');
  if (!dia || !mes || !ano) return dateStr;
  return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
}

/**
 * Rota de vendas: busca NF-e na Omie (NFConsultar / ListarNF)
 * filtrando apenas notas de SAÍDA, ambiente de produção
 * e ignorando notas com valor 0.
 */
app.get('/api/vendas', async (req, res) => {
  try {
    const payload = {
      call: 'ListarNF',
      app_key: process.env.OMIE_APP_KEY,
      app_secret: process.env.OMIE_APP_SECRET,
      param: [
        {
          pagina: 1,
          registros_por_pagina: 100,
          apenas_importado_api: 'N',
          tpNF: '1',          // 1 = saída (venda)
          tpAmb: '1',         // 1 = produção
          cApenasResumo: 'S', // só o resumo da NF
          // se quiser limitar por período depois:
          // dEmiInicial: '01/01/2025',
          // dEmiFinal:   '31/12/2025',
        },
      ],
    };

    const { data } = await axios.post(
      'https://app.omie.com.br/api/v1/produtos/nfconsultar/',
      payload
    );

    const registros = data.nfCadastro || [];

    let vendas = registros.map((nf, index) => {
      const ide = nf.ide || {};
      const dest = nf.nfDestInt || {};
      const total = nf.total || {};

      const emissao = ide.dEmi || '';
      const rawValor = total.vNF ?? 0;

      const valorNumero = Number(
        rawValor.toString().replace('.', '').replace(',', '.')
      );

      return {
        id: (nf.compl && nf.compl.nIdNF) || index + 1,
        data: emissao.includes('/') ? brToIso(emissao) : emissao,
        cliente: dest.cRazao || 'N/A',
        documento: ide.nNF || '',
        valorTotal: isNaN(valorNumero) ? 0 : valorNumero,
        status: ide.finNFe || 'N/D',
      };
    });

    // Mantém apenas notas com valor > 0
    vendas = vendas.filter((v) => v.valorTotal > 0);

    res.json(vendas);
  } catch (error) {
    console.error('Erro Omie:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Dados:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Mensagem:', error.message);
    }
    res.status(500).json({ error: 'Erro ao consultar NF-e na Omie' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Acesse: http://localhost:${PORT}/api/vendas`);
});

