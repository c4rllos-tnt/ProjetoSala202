import * as SQLite from 'expo-sqlite';

let promessaBanco;

export function abrirBanco() {
  if (!promessaBanco) {
    promessaBanco = (async () => {
      const db = await SQLite.openDatabaseAsync('familia.db');
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS movimentacoes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          descricao TEXT NOT NULL,
          valor_centavos INTEGER NOT NULL CHECK (valor_centavos > 0),
          tipo TEXT NOT NULL CHECK (tipo IN ('Receita', 'Despesa')),
          data TEXT NOT NULL
        );
      `);
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS rendas_mensais (
          mes TEXT PRIMARY KEY,
          valor_centavos INTEGER NOT NULL CHECK (valor_centavos > 0)
        );
      `);
      // Migração segura: preserva os registros existentes.
      const colunas = await db.getAllAsync('PRAGMA table_info(movimentacoes)');
      if (!colunas.some(c => c.name === 'categoria')) {
        await db.execAsync('ALTER TABLE movimentacoes ADD COLUMN categoria TEXT');
      }
      return db;
    })().catch((erro) => {
      promessaBanco = undefined;
      throw erro;
    });
  }
  return promessaBanco;
}

export async function listarMovimentacoes() {
  const db = await abrirBanco();
  return db.getAllAsync('SELECT * FROM movimentacoes ORDER BY data DESC, id DESC');
}

export async function obterMovimentacao(id) {
  const db = await abrirBanco();
  return db.getFirstAsync('SELECT * FROM movimentacoes WHERE id = ?', [id]);
}

export const CATEGORIAS = ['Despesas de casa', 'Alimentação', 'Lazer', 'Estudos', 'Extras'];

export async function salvarMovimentacao({ id, descricao, valorCentavos, tipo, categoria }) {
  const db = await abrirBanco();
  const nome = descricao.trim();
  if (!nome || !Number.isSafeInteger(valorCentavos) || valorCentavos <= 0 || !['Receita', 'Despesa'].includes(tipo)) {
    throw new Error('Dados inválidos para a movimentação.');
  }
  const categoriaFinal = tipo === 'Despesa' ? categoria : null;
  if (tipo === 'Despesa' && !CATEGORIAS.includes(categoriaFinal)) {
    throw new Error('Selecione uma categoria de despesa.');
  }
  if (id != null) {
    const result = await db.runAsync(
      'UPDATE movimentacoes SET descricao = ?, valor_centavos = ?, tipo = ?, categoria = ? WHERE id = ?',
      [nome, valorCentavos, tipo, categoriaFinal, id]
    );
    if (result.changes === 0) throw new Error('Registro não encontrado.');
  } else {
    const data = new Date();
    const local = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
    await db.runAsync(
      'INSERT INTO movimentacoes (descricao, valor_centavos, tipo, data, categoria) VALUES (?, ?, ?, ?, ?)',
      [nome, valorCentavos, tipo, local, categoriaFinal]
    );
  }
}

export async function excluirMovimentacao(id) {
  const db = await abrirBanco();
  await db.runAsync('DELETE FROM movimentacoes WHERE id = ?', [id]);
}

export function formatarMoeda(centavos) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function textoParaCentavos(texto) {
  const valor = texto.trim();
  // Entrada em português brasileiro: 150; 150,50; 1.250,50
  if (!/^\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?$|^\d+(?:,\d{1,2})?$/.test(valor)) {
    return null;
  }
  const [inteiro, decimal = ''] = valor.replace(/\./g, '').split(',');
  const total = Number(inteiro) * 100 + Number(decimal.padEnd(2, '0'));
  return Number.isSafeInteger(total) && total > 0 ? total : null;
}

// Mes corrente do aparelho, em formato AAAA-MM.
export function mesAtual() {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
}

export async function consultarRendaFamiliar(mes = mesAtual()) {
  const db = await abrirBanco();
  return db.getFirstAsync('SELECT valor_centavos FROM rendas_mensais WHERE mes = ?', [mes]);
}

export async function definirRendaFamiliar(valorCentavos, mes = mesAtual()) {
  if (!Number.isSafeInteger(valorCentavos) || valorCentavos <= 0) {
    throw new Error('Informe uma renda válida.');
  }
  const db = await abrirBanco();
  // A restrição PRIMARY KEY impede uma segunda definição no mesmo mês.
  const resultado = await db.runAsync(
    'INSERT OR IGNORE INTO rendas_mensais (mes, valor_centavos) VALUES (?, ?)',
    [mes, valorCentavos]
  );
  if (resultado.changes !== 1) {
    throw new Error('A renda familiar deste mês já foi definida.');
  }
  return consultarRendaFamiliar(mes);
}

// Saldo transportado: calculado a partir dos meses anteriores.
// Nao cria uma segunda movimentacao nem altera a renda ja definida.
export async function consultarResumoMensal(mes = mesAtual()) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) {
    throw new Error('Mes invalido. Use AAAA-MM.');
  }

  const db = await abrirBanco();

  const rendaAtual = await db.getFirstAsync(
    'SELECT valor_centavos FROM rendas_mensais WHERE mes = ?',
    [mes]
  );

  const rendasPassadas = await db.getFirstAsync(
    'SELECT COALESCE(SUM(valor_centavos), 0) AS total FROM rendas_mensais WHERE mes < ?',
    [mes]
  );

  const movimentacoesPassadas = await db.getFirstAsync(`
    SELECT
      COALESCE(SUM(CASE WHEN tipo = 'Receita' THEN valor_centavos ELSE 0 END), 0) AS receitas,
      COALESCE(SUM(CASE WHEN tipo = 'Despesa' THEN valor_centavos ELSE 0 END), 0) AS despesas
    FROM movimentacoes
    WHERE substr(data, 1, 7) < ?
  `, [mes]);

  const movimentacoesAtuais = await db.getFirstAsync(`
    SELECT
      COALESCE(SUM(CASE WHEN tipo = 'Receita' THEN valor_centavos ELSE 0 END), 0) AS receitas,
      COALESCE(SUM(CASE WHEN tipo = 'Despesa' THEN valor_centavos ELSE 0 END), 0) AS despesas
    FROM movimentacoes
    WHERE substr(data, 1, 7) = ?
  `, [mes]);

  const saldoAnterior =
    rendasPassadas.total +
    movimentacoesPassadas.receitas -
    movimentacoesPassadas.despesas;

  const renda = rendaAtual?.valor_centavos ?? 0;
  const receitas = movimentacoesAtuais.receitas;
  const despesas = movimentacoesAtuais.despesas;

  return {
    renda,
    saldoAnterior,
    receitas,
    despesas,
    saldo: saldoAnterior + renda + receitas - despesas
  };
}
