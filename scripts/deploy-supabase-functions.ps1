param(
  [string]$ProjectRef = "qejgnygxtucmrhfpsfke"
)

$ErrorActionPreference = "Stop"

if (-not $env:SUPABASE_ACCESS_TOKEN) {
  Write-Error "Falta SUPABASE_ACCESS_TOKEN. Crea un access token en Supabase y ejecuta: `$env:SUPABASE_ACCESS_TOKEN='tu-token'"
}

$localSupabase = Join-Path $PWD ".tools\supabase\supabase.exe"
$supabase = Get-Command supabase -ErrorAction SilentlyContinue

if (Test-Path $localSupabase) {
  $supabase = $localSupabase
}

if ($supabase) {
  & $supabase functions deploy create-system-user --project-ref $ProjectRef
  & $supabase functions deploy reset-system-user-password --project-ref $ProjectRef
  exit $LASTEXITCODE
}

$docker = Get-Command docker -ErrorAction SilentlyContinue

if (-not $docker) {
  Write-Error "No encontré Supabase CLI ni Docker. Instala Supabase CLI o Docker Desktop para desplegar las funciones."
}

docker run --rm `
  -e SUPABASE_ACCESS_TOKEN=$env:SUPABASE_ACCESS_TOKEN `
  -v "${PWD}:/work" `
  -w /work `
  supabase/cli:latest `
  functions deploy create-system-user --project-ref $ProjectRef

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

docker run --rm `
  -e SUPABASE_ACCESS_TOKEN=$env:SUPABASE_ACCESS_TOKEN `
  -v "${PWD}:/work" `
  -w /work `
  supabase/cli:latest `
  functions deploy reset-system-user-password --project-ref $ProjectRef

exit $LASTEXITCODE
