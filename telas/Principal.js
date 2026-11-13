import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { consultarResumoMensal, formatarMoeda } from '../banco';

export default function Principal() {
  const [mostrarRenda, setMostrarRenda] = useState(false);
  const [dados, setDados] = useState({
    saldoAnterior: 0,
    renda: 0,
    receitas: 0,
    despesas: 0,
    saldo: 0
  });
  const [erro, setErro] = useState('');
  const valorVisivel = valor =>
  mostrarRenda ? formatarMoeda(valor) : 'R$ ••••••';

  useFocusEffect(useCallback(() => {
    let ativo = true;

    consultarResumoMensal()
      .then(resumo => {
        if (!ativo) return;
        setDados(resumo);
        setErro('');
      })
      .catch(e => {
        if (ativo) setErro(`Erro no banco: ${e.message}`);
      });

    return () => {
      ativo = false;
    };
  }, []));

  return (
    <View style={styles.cartao}>
      <Text style={styles.rotulo}>SALDO DISPONÍVEL</Text>

      <Text style={[
        styles.saldo,
        mostrarRenda && dados.saldo < 0 && styles.negativo
      ]}>
        {valorVisivel(dados.saldo)}
      </Text>

      <View style={styles.linhaRenda}>
        <Text style={[styles.descricao, styles.textoRenda]}>
          Renda Familiar: {mostrarRenda
            ? formatarMoeda(dados.renda)
            : 'R$ ••••••'}
        </Text>
        <Pressable
          onPress={() => setMostrarRenda(valor => !valor)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={mostrarRenda ? 'Ocultar renda' : 'Mostrar renda'}
        >
          <Ionicons
            name={mostrarRenda ? 'eye-outline' : 'eye-off-outline'}
            size={24}
            color="#64748B"
          />
        </Pressable>
      </View>

 <Text style={styles.descricao}>
  Receitas Extras: {valorVisivel(dados.receitas)}
</Text>
      <Text style={styles.descricao}>
  Receitas Extras: {valorVisivel(dados.receitas)}
</Text>

<Text style={styles.descricao}>
  Despesas: {valorVisivel(dados.despesas)}
</Text>

      {!!erro && <Text style={styles.erro}>{erro}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  cartao: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 25,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  rotulo: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#64748B',
    marginBottom: 12,
  },
  saldo: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#16803C',
    marginBottom: 12,
  },
  negativo: {
    color: '#B91C1C',
  },
  descricao: {
    fontSize: 16,
    color: '#475569',
    lineHeight: 30,
  },
  linhaRenda: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textoRenda: {
    flexShrink: 1,
  },
  erro: {
    color: '#B91C1C',
    marginTop: 12,
  },
});
