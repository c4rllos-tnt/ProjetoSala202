import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, Alert, Platform, Modal, ScrollView, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { listarMovimentacoes, excluirMovimentacao, consultarResumoMensal, formatarMoeda, mesAtual, CATEGORIAS } from '../banco';

export default function Relatorio({ navigation }) {
  const [itens, setItens] = useState([]);
  const [erro, setErro] = useState('');
  const [filtroAberto, setFiltroAberto] = useState(false);
  const [periodo, setPeriodo] = useState('mes');
  const [dataFiltro, setDataFiltro] = useState('todas');
  const [categoriaFiltro, setCategoriaFiltro] = useState('Todas');
  const [escolha, setEscolha] = useState(null);
  const [saldoAnterior, setSaldoAnterior] = useState(null);

  // Para um filtro por dia, usa o saldo do início daquele mês.
  // Para um filtro por ano, usa o saldo do início daquele ano.
  // Sem filtro de data, mostra o saldo anterior ao mês atual.
  const mesReferencia = dataFiltro === 'todas'
    ? mesAtual()
    : periodo === 'ano'
      ? `${dataFiltro}-01`
      : dataFiltro.slice(0, 7);
    
  const atualizar = useCallback(async () => {
    const registros = await listarMovimentacoes();
    setItens(registros);
    setErro('');

    try {
      const resumo = await consultarResumoMensal(mesReferencia);
      setSaldoAnterior(resumo.saldoAnterior);
    } catch (e) {
      setErro(`Erro ao consultar saldo anterior: ${e.message}`);
    }
  }, [mesReferencia]);

  useFocusEffect(useCallback(() => {
    let ativo = true;
    setSaldoAnterior(null);

    async function carregar() {
      try {
        const registros = await listarMovimentacoes();
        if (!ativo) return;
        setItens(registros);
        setErro('');
      } catch (e) {
        if (ativo) {
          setErro(`Erro ao carregar registros: ${e.message}`);
        }
      }

      try {
        const resumo = await consultarResumoMensal(mesReferencia);
        if (ativo) setSaldoAnterior(resumo.saldoAnterior);
      } catch (e) {
        if (ativo) {
          setErro(`Erro ao consultar saldo anterior: ${e.message}`);
        }
      }
    }

    carregar();
    return () => { ativo = false; };
  }, [mesReferencia]));

  

  
async function apagar(id) {
  try {
    await excluirMovimentacao(id);
    await atualizar();

    if (Platform.OS === 'web') {
      window.alert('Movimentação excluída com sucesso!');
    } else {
      Alert.alert(
        'Exclusão concluída',
        'Movimentação excluída com sucesso!'
      );
    }

  } catch (e) {
    setErro(`Erro ao excluir: ${e.message}`);
  }
}


  function confirmarExclusao(item) {
    if (Platform.OS === 'web') {
      // No navegador, usamos a confirmação nativa; no Android, Alert.alert.
      if (typeof window !== 'undefined' && window.confirm(`Excluir "${item.descricao}"?`)) apagar(item.id);
    } else {
      Alert.alert('Excluir movimentação?', item.descricao, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: () => apagar(item.id) },
      ]);
    }
  }

  function chaveData(item) {
    if (periodo === 'dia') return item.data;
    if (periodo === 'ano') return item.data.slice(0, 4);
    return item.data.slice(0, 7);
  }

  const datas = [...new Set(itens.map(chaveData))].sort().reverse();
  const dataAtiva = dataFiltro === 'todas' || datas.includes(dataFiltro) ? dataFiltro : 'todas';
  const visiveis = itens.filter(item =>
    (dataAtiva === 'todas' || chaveData(item) === dataAtiva) &&
    (categoriaFiltro === 'Todas' ||
      (categoriaFiltro === 'Sem categoria' && item.tipo === 'Despesa' && !item.categoria) ||
      item.categoria === categoriaFiltro)
  );
  const receitas = visiveis.filter(item => item.tipo === 'Receita').reduce((s, item) => s + item.valor_centavos, 0);
  const despesas = visiveis.filter(item => item.tipo === 'Despesa').reduce((s, item) => s + item.valor_centavos, 0);
  const categoriasFiltro = ['Todas', ...CATEGORIAS, 'Sem categoria'];
  const nomeData = valor => valor === 'todas' ? 'Todos os períodos' : valor;

  return (
    <View style={styles.cartao}>
      <View style={styles.cabecalhoFiltro}>
        <Text style={styles.rotulo}>RELATÓRIO DE MOVIMENTAÇÕES</Text>
        <Pressable style={styles.funil} onPress={() => setFiltroAberto(true)} accessibilityRole="button" accessibilityLabel="Abrir filtros">
          <Ionicons name="funnel-outline" size={19} color="#173A63" style={{ marginRight: 5 }} />
          <Text style={styles.textoFunil}>FILTRAR</Text>
        </Pressable>
      </View>
      <Text style={styles.resumo}>Período: {nomeData(dataAtiva)} · Categoria: {categoriaFiltro}</Text>

      <View style={styles.campoSaldoAnterior}>
        <Text style={styles.rotuloSaldoAnterior}>
          {dataFiltro === 'todas'
            ? 'SALDO ANTERIOR AO MÊS ATUAL'
            : periodo === 'ano'
              ? 'SALDO ANTERIOR AO ANO'
              : 'SALDO ANTERIOR AO MÊS'}
        </Text>
        <Text style={styles.valorSaldoAnterior} selectable>
          {saldoAnterior === null ? 'Consultando...' : formatarMoeda(saldoAnterior)}
        </Text>
      </View>


      <Modal
        transparent
        visible={filtroAberto}
        animationType="fade"
        onRequestClose={() => {
          setFiltroAberto(false);
          setEscolha(null);
        }}
      >
       
<View style={styles.fundoModal}>
  <ScrollView
    style={styles.caixaModal}
    contentContainerStyle={{ padding: 20 }}
    nestedScrollEnabled
    keyboardShouldPersistTaps="handled"
  >

    {/* CABEÇALHO COM X */}
    <View style={styles.cabecalhoModal}>
      <Text style={styles.tituloModal}>FILTROS</Text>

      <Pressable
        style={styles.fecharModal}
        onPress={() => {
          setFiltroAberto(false);
          setEscolha(null);
        }}
        accessibilityRole="button"
        accessibilityLabel="Fechar filtros"
        hitSlop={8}
      >
        <Ionicons
          name="close"
          size={28}
          color="#B91C1C"
        />
      </Pressable>
    </View>

    {/* PERÍODO */}
    <Text style={styles.subtitulo}>PERÍODO</Text>

    <View style={styles.tiposPeriodo}>
      {['dia', 'mes', 'ano'].map(p => (
        <Pressable
          key={p}
          style={[
            styles.pilula,
            periodo === p && styles.ativo
          ]}
          onPress={() => {
            setPeriodo(p);
            setDataFiltro('todas');
            setEscolha(null);
          }}
        >
          <Text style={[
            styles.textoPilula,
            periodo === p && styles.textoAtivo
          ]}>
            {p === 'dia' ? 'Dia' : p === 'mes' ? 'Mês' : 'Ano'}
          </Text>
        </Pressable>
      ))}
    </View>

    {/* SELETOR DE DATAS */}
    <Pressable
      style={styles.seletor}
      onPress={() => {
        setEscolha(
          escolha === 'data' ? null : 'data'
        );
      }}
    >
      <Text style={styles.textoSelecao}>
        {nomeData(dataAtiva)} ▾
      </Text>
    </Pressable>

    {escolha === 'data' && (
      <View style={styles.listaOpcoes}>
        {['todas', ...datas].map(d => (
          <Pressable
            key={d}
            style={styles.opcao}
            onPress={() => {
              setDataFiltro(d);
              setEscolha(null);
            }}
          >
            <Text style={styles.textoSelecao}>
              {nomeData(d)}
            </Text>
          </Pressable>
        ))}
      </View>
    )}

    {/* CATEGORIA */}
    <Text style={styles.subtitulo}>CATEGORIA</Text>

    <Pressable
      style={styles.seletor}
      onPress={() => {
        setEscolha(
          escolha === 'categoria' ? null : 'categoria'
        );
      }}
    >
      <Text style={styles.textoSelecao}>
        {categoriaFiltro} ▾
      </Text>
    </Pressable>

    {escolha === 'categoria' && (
      <View style={styles.listaOpcoes}>
        {categoriasFiltro.map(c => (
          <Pressable
            key={c}
            style={styles.opcao}
            onPress={() => {
              setCategoriaFiltro(c);
              setEscolha(null);
            }}
          >
            <Text style={styles.textoSelecao}>
              {c}
            </Text>
          </Pressable>
        ))}
      </View>
    )}

    {/* APLICAR */}
    <Pressable
      style={styles.aplicar}
      onPress={() => {
        setFiltroAberto(false);
        setEscolha(null);
      }}
    >
      <Text style={styles.acaoTexto}>
        APLICAR
      </Text>
    </Pressable>

    {/* LIMPAR */}
    <Pressable
      style={styles.limpar}
      onPress={() => {
        setPeriodo('mes');
        setDataFiltro('todas');
        setCategoriaFiltro('Todas');
        setEscolha(null);
      }}
    >
      <Text style={styles.textoSelecao}>
        LIMPAR FILTROS
      </Text>
    </Pressable>

  </ScrollView>
</View>
</Modal>


      <Text style={styles.resumo}>Receitas: {formatarMoeda(receitas)}</Text>
      <Text style={styles.resumo}>Despesas: {formatarMoeda(despesas)}</Text>
      <Text style={styles.resumo}>Saldo: {formatarMoeda(receitas - despesas)}</Text>
      <Text style={styles.subtitulo}>REGISTROS ({visiveis.length})</Text>
      {visiveis.length === 0 && <Text style={styles.vazio}>Nenhum registro nesta seleção.</Text>}
      {visiveis.map((item) => (
        <View key={item.id} style={styles.registro}>
          <Text style={styles.descricao}>{item.descricao}</Text>
          <Text style={styles.info}>{item.tipo} · {item.data} · {item.categoria || (item.tipo === 'Despesa' ? 'Sem categoria' : 'Receita extra')} · {formatarMoeda(item.valor_centavos)}</Text>
          <View style={styles.acoes}>
            <Pressable style={styles.editar} onPress={() => navigation.navigate('Movimentação', { editarId: item.id })}>
              <Text style={styles.acaoTexto}>EDITAR</Text>
            </Pressable>
            <Pressable style={styles.excluir} onPress={() => confirmarExclusao(item)}>
              <Text style={styles.acaoTexto}>EXCLUIR</Text>
            </Pressable>
          </View>
        </View>
      ))}
      {!!erro && <Text style={styles.erro}>{erro}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  cabecalhoModal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  tituloModal: { fontSize: 18, fontWeight: 'bold', color: '#173A63' },
  fecharModal: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' },
  campoSaldoAnterior: { backgroundColor: '#F1F5F9', borderColor: '#CBD5E1', borderWidth: 1, borderRadius: 10, padding: 14, marginTop: 8, marginBottom: 15 },
  rotuloSaldoAnterior: { fontSize: 12, fontWeight: 'bold', color: '#64748B', marginBottom: 6 },
  valorSaldoAnterior: { fontSize: 20, fontWeight: 'bold', color: '#173A63' },
  cabecalhoFiltro: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  funil: { flexDirection: 'row', alignItems: 'center', padding: 8, backgroundColor: '#E8F0FE', borderRadius: 8 },
  iconeFunil: { color: '#173A63', fontSize: 20, marginRight: 4 },
  textoFunil: { color: '#173A63', fontSize: 12, fontWeight: 'bold' },
  fundoModal: { flex: 1, backgroundColor: '#0008', justifyContent: 'center', padding: 16 },
  caixaModal: {
  backgroundColor: '#FFFFFF',
  borderRadius: 16,
  maxHeight: '90%',
  width: '100%'
},

listaOpcoes: {
  borderWidth: 1,
  borderColor: '#E2E8F0',
  marginBottom: 12
},
  tiposPeriodo: { flexDirection: 'row', gap: 8, marginVertical: 12 },
  pilula: { paddingVertical: 9, paddingHorizontal: 13, borderRadius: 8, backgroundColor: '#E2E8F0' },
  ativo: { backgroundColor: '#173A63' },
  textoPilula: { color: '#173A63', fontWeight: 'bold' },
  textoAtivo: { color: '#FFFFFF' },
  seletor: { borderWidth: 1, borderColor: '#CBD5E1', padding: 12, borderRadius: 8, marginBottom: 12 },
  listaOpcoes: { maxHeight: 145, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 12 },
  opcao: { padding: 9, borderBottomWidth: 1, borderColor: '#E2E8F0' },
  textoSelecao: { color: '#173A63', fontSize: 14 },
  aplicar: { backgroundColor: '#16803C', alignItems: 'center', padding: 14, borderRadius: 8, marginTop: 8 },
  limpar: { alignItems: 'center', padding: 12 },

  cartao: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 25, elevation: 3, borderWidth: 1, borderColor: '#E2E8F0' },
  rotulo: { fontSize: 16, fontWeight: 'bold', color: '#173A63', marginBottom: 18 },
  resumo: { fontSize: 16, color: '#475569', marginBottom: 8 },
  subtitulo: { marginTop: 20, marginBottom: 12, fontWeight: 'bold', color: '#173A63' },
  vazio: { color: '#64748B', marginVertical: 10 },
  registro: { borderTopWidth: 1, borderColor: '#E2E8F0', paddingVertical: 14 },
  descricao: { fontSize: 17, fontWeight: 'bold', color: '#173A63' },
  info: { fontSize: 13, color: '#475569', marginTop: 4 },
  acoes: { flexDirection: 'row', gap: 10, marginTop: 12 },
  editar: { backgroundColor: '#173A63', padding: 10, borderRadius: 7 },
  excluir: { backgroundColor: '#B91C1C', padding: 10, borderRadius: 7 },
  acaoTexto: { fontSize: 12, fontWeight: 'bold', color: '#FFFFFF' },
  erro: { color: '#B91C1C', marginTop: 12 },
});
