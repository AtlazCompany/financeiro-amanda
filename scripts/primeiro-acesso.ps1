# Gera o link de primeiro acesso da Amanda (Supabase Auth Admin / generateLink "recovery").
# Uso, em um PowerShell SEU (nao dentro do chat):   cd C:\Users\ponte\projetos\financeiro-amanda ; .\scripts\primeiro-acesso.ps1
# Opcional: .\scripts\primeiro-acesso.ps1 -AntiPrevia
param([switch]$AntiPrevia)
$ErrorActionPreference = 'Stop'
$secure = Read-Host 'Chave service_role (Supabase > Project Settings > API). Nao sera exibida' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  $env:SUPABASE_SERVICE_ROLE_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  $env:FIRST_ACCESS_EMAIL = Read-Host 'E-mail definitivo da Amanda'
  if ($AntiPrevia) { node scripts/first-access-link.mjs --anti-previa } else { node scripts/first-access-link.mjs }
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:FIRST_ACCESS_EMAIL -ErrorAction SilentlyContinue
}
