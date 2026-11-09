const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/** Formata centavos inteiros como R$ 1.234,56 */
export function formatBRL(cents: number): string {
  return brl.format(cents / 100).replace(/ /g, ' ')
}

/** Converte reais (ex.: da planilha) para centavos inteiros, sem erro de ponto flutuante. */
export function reaisToCents(reais: number): number {
  return Math.round(Number((reais * 100).toPrecision(12)))
}

/** Campo monetario "estilo caixa": os digitos digitados entram pela direita. */
export function digitsToCents(text: string): number {
  const digits = text.replace(/\D/g, '').slice(0, 11)
  return digits ? parseInt(digits, 10) : 0
}

export function centsToInputText(cents: number): string {
  if (!cents) return ''
  return brl.format(cents / 100).replace(/ /g, ' ')
}
