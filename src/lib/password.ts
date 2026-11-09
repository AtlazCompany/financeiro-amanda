/** Regras minimas de senha (definida pela propria usuaria). Nunca registrar nem exibir a senha. */
export const MIN_PASSWORD = 10

export function validateNewPassword(password: string, confirm: string, email?: string): string | null {
  if (password.length < MIN_PASSWORD) return `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`
  if (/^\d+$/.test(password)) return 'Use também letras, não só números.'
  if (new Set(password).size < 4) return 'Escolha uma senha menos repetitiva.'
  if (email && password.toLowerCase().includes(email.split('@')[0].toLowerCase()) && email.split('@')[0].length >= 4) {
    return 'A senha não pode conter o seu e-mail.'
  }
  if (password !== confirm) return 'As duas senhas não são iguais.'
  return null
}
