import { describe, expect, it } from 'vitest'
import { authErrorMessage, parseAuthHash } from './authLink'
import { MIN_PASSWORD, validateNewPassword } from './password'

describe('parseAuthHash', () => {
  it('reconhece o link de recuperacao', () => {
    const l = parseAuthHash('#access_token=AAA.BBB.CCC&expires_in=3600&refresh_token=rrr&token_type=bearer&type=recovery')
    expect(l).toEqual({ kind: 'recovery', accessToken: 'AAA.BBB.CCC', refreshToken: 'rrr' })
  })
  it('reconhece link expirado', () => {
    const l = parseAuthHash('#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired')
    expect(l).toEqual({ kind: 'error', code: 'otp_expired' })
    expect(authErrorMessage('otp_expired')).toMatch(/expirou/)
  })
  it('ignora rotas normais do app e hashes vazios', () => {
    expect(parseAuthHash('')).toBeNull()
    expect(parseAuthHash('#')).toBeNull()
    expect(parseAuthHash('#/vendas')).toBeNull()
    expect(parseAuthHash('#/login?x=1')).toBeNull()
  })
  it('nao trata tokens de outro tipo como recuperacao', () => {
    expect(parseAuthHash('#access_token=a&refresh_token=b&type=signup')).toBeNull()
    expect(parseAuthHash('#access_token=a&type=recovery')).toBeNull()
  })
})

describe('validateNewPassword', () => {
  it('aceita senha forte e igual na confirmacao', () => {
    expect(validateNewPassword('Rosa&Cafe2026!', 'Rosa&Cafe2026!', 'amanda@exemplo.com')).toBeNull()
  })
  it('exige tamanho minimo', () => {
    expect(validateNewPassword('curta1', 'curta1')).toMatch(String(MIN_PASSWORD))
  })
  it('rejeita so numeros, repetitiva e contendo o e-mail', () => {
    expect(validateNewPassword('1234567890', '1234567890')).toMatch(/letras/)
    expect(validateNewPassword('aaaaaaaaaaaa', 'aaaaaaaaaaaa')).toMatch(/repetitiva/)
    expect(validateNewPassword('amanda12345!', 'amanda12345!', 'amanda@exemplo.com')).toMatch(/e-mail/)
  })
  it('exige confirmacao igual', () => {
    expect(validateNewPassword('Rosa&Cafe2026!', 'Rosa&Cafe2026?')).toMatch(/iguais/)
  })
})
