param(
    [string]$VoiceId = '',
    [ValidateRange(100,100000)][int]$MaxCharactersPerHour = 12000,
    [switch]$CheckOnly
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$serverFile = Join-Path $projectRoot 'server.js'
$nodeExecutable = (Get-Command node -ErrorAction Stop).Source
if (-not (Test-Path -LiteralPath $serverFile -PathType Leaf)) { throw 'No se encuentra el servidor LivesIA.' }
if ($VoiceId -and $VoiceId -notmatch '^[A-Za-z0-9_-]{8,80}$') { throw 'Voice ID no válido.' }
$listener = Get-NetTCPConnection -LocalPort 4173 -State Listen -ErrorAction SilentlyContinue
if ($CheckOnly) {
    @{ server = $serverFile; node = $nodeExecutable; portAvailable = -not [bool]$listener;
       voiceSelected = [bool]$VoiceId; keyEntry = 'masked-local-prompt'; storesKey = $false;
       characterLimit = $MaxCharactersPerHour; startsBroadcast = $false } | ConvertTo-Json
    return
}
if ($listener) { throw 'El puerto 4173 está ocupado. Detén primero el servidor LivesIA anterior; este lanzador no cierra procesos ajenos.' }
if (-not $VoiceId) { $VoiceId = Read-Host 'Voice ID elegido en ElevenLabs' }
if ($VoiceId -notmatch '^[A-Za-z0-9_-]{8,80}$') { throw 'Voice ID no válido.' }
$speechSecret = Read-Host 'Clave ElevenLabs (oculta; no se guarda en archivos)' -AsSecureString
if ($speechSecret.Length -eq 0) { $speechSecret.Dispose(); throw 'No se introdujo una clave.' }
$names = @('ELEVENLABS_API_KEY','ELEVENLABS_VOICE_ID','ELEVENLABS_MAX_CHARACTERS_PER_HOUR','ELEVENLABS_MODEL_ID')
$previous = @{}
foreach ($name in $names) { $previous[$name] = [Environment]::GetEnvironmentVariable($name,'Process') }
$speechPointer = [IntPtr]::Zero
try {
    $speechPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($speechSecret)
    $env:ELEVENLABS_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($speechPointer)
    if ($env:ELEVENLABS_API_KEY -notmatch '^[A-Za-z0-9_-]{16,256}$') { throw 'Formato de clave no válido.' }
    $env:ELEVENLABS_VOICE_ID = $VoiceId
    $env:ELEVENLABS_MAX_CHARACTERS_PER_HOUR = [string]$MaxCharactersPerHour
    $env:ELEVENLABS_MODEL_ID = 'eleven_flash_v2_5'
    Write-Output 'Servidor local con voz configurada. Mantén esta ventana abierta; Ctrl+C lo detiene. No inicia OBS ni emite.'
    & $nodeExecutable $serverFile
    if ($LASTEXITCODE -ne 0) { throw 'El servidor terminó con error. Revisa el diagnóstico local sin compartir credenciales.' }
} finally {
    if ($speechPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($speechPointer) }
    $speechSecret.Dispose()
    foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name,$previous[$name],'Process') }
}
