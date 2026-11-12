param([switch]$CheckOnly,[ValidateSet('local','youtube')][string]$Platform='local')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$obsRoot = Join-Path $env:LOCALAPPDATA 'LivesIA/obs-studio/33.0.1'
$obsExecutable = Join-Path $obsRoot 'bin/64bit/obs64.exe'
$obsName = if ($Platform -eq 'youtube') { 'LivesIA YouTube' } else { 'LivesIA Ensayo' }
$fileName = if ($Platform -eq 'youtube') { 'LivesIA_YouTube' } else { 'LivesIA_Ensayo' }
$sceneName = if ($Platform -eq 'youtube') { 'Mina YouTube' } else { 'Mina LIVE' }
$scene = Join-Path $obsRoot "config/obs-studio/basic/scenes/$fileName.json"
$profile = Join-Path $obsRoot "config/obs-studio/basic/profiles/$fileName/basic.ini"
foreach ($requiredPath in @($obsExecutable, $scene, $profile)) {
    if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
        throw "Falta preparar OBS. Consulta docs/block-wars/FIRST_LIVE_SETUP.md. Archivo: $requiredPath"
    }
}
$signature = Get-AuthenticodeSignature -LiteralPath $obsExecutable
if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notlike '*OBS Project*') {
    throw 'No se pudo verificar la firma del ejecutable de OBS.'
}
$nodeExecutable = (Get-Command node -ErrorAction Stop).Source
if ($CheckOnly) {
    @{ ready = $true; obs = $obsExecutable; node = $nodeExecutable; scene = $scene; profile = $profile; startsBroadcast = $false } | ConvertTo-Json
    return
}
$runtimeDirectory = Join-Path $env:LOCALAPPDATA 'LivesIA/runtime'
New-Item -ItemType Directory -Path $runtimeDirectory -Force | Out-Null
$listener = Get-NetTCPConnection -LocalPort 4173 -State Listen -ErrorAction SilentlyContinue
if (-not $listener) {
    Start-Process -FilePath $nodeExecutable -ArgumentList ('"' + (Join-Path $projectRoot 'server.js') + '"') -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimeDirectory 'server.log') -RedirectStandardError (Join-Path $runtimeDirectory 'server-error.log') | Out-Null
}
$healthy = $false
for ($attempt = 0; $attempt -lt 20; $attempt++) {
    try {
        $status = Invoke-RestMethod 'http://127.0.0.1:4173/api/block-wars/speech/status' -TimeoutSec 1
        if ($null -eq $status.keyConfigured -or $null -eq $status.inFlight) { throw 'Otro servicio ocupa el puerto 4173.' }
        $healthy = $true
        break
    } catch { Start-Sleep -Milliseconds 250 }
}
if (-not $healthy) { throw 'No responde LivesIA en loopback. Revisa el servidor o el puerto 4173.' }
$runningObs = @(Get-Process obs64 -ErrorAction SilentlyContinue)
if ($runningObs.Count -eq 0) {
    Start-Process -FilePath $obsExecutable -ArgumentList '--portable','--disable-updater','--collection',('"'+$obsName+'"'),'--profile',('"'+$obsName+'"'),'--scene',('"'+$sceneName+'"') -WorkingDirectory (Join-Path $obsRoot 'bin/64bit') | Out-Null
} else {
    Write-Output "OBS ya está abierto. Comprueba perfil/colección $obsName; no se altera la sesión activa."
}
$controlUrl = if ($Platform -eq 'youtube') { 'http://127.0.0.1:4173/block-wars/control?platform=youtube' } else { 'http://127.0.0.1:4173/block-wars/control' }
Start-Process $controlUrl
Write-Output 'Ensayo local preparado. No se inicia transmisión, grabación, cámara ni micrófono.'
