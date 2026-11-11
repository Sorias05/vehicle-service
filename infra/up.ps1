[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$InfraDir = (Resolve-Path $PSScriptRoot).Path
$ProjectRoot = (Resolve-Path (Join-Path $InfraDir '..')).Path
$K8sDir = Join-Path $InfraDir 'k8s'
$TempFiles = [System.Collections.Generic.List[string]]::new()

# Infrastructure dependencies registry.
$InfrastructureRegistry = @(
    [pscustomobject]@{
        Key                     = 'postgres'
        DisplayName             = 'PostgreSQL'
        PortSetting             = 'POSTGRES_HOST_PORT'
        DefaultPort             = 5433
        BackendSecretKey        = 'POSTGRES_URI'
        ComposeEndpoint         = 'postgres:5432'
        ClusterEndpointTemplate = 'host.docker.internal:{0}'
    }
    [pscustomobject]@{
        Key         = 'redis'
        DisplayName = 'Redis'
        PortSetting = 'REDIS_HOST_PORT'
        DefaultPort = 6379
    }
    [pscustomobject]@{
        Key         = 'rabbitmq'
        DisplayName = 'RabbitMQ'
        PortSetting = 'RABBITMQ_HOST_PORT'
        DefaultPort = 5672
    }
    [pscustomobject]@{
        Key                           = 'localstack'
        DisplayName                   = 'LocalStack'
        PortSetting                   = 'LOCALSTACK_HOST_PORT'
        DefaultPort                   = 4566
        BackendConfigKey              = 'AWS_S3_ENDPOINT'
        BackendConfigEndpointTemplate = 'http://host.docker.internal:{0}'
        HealthService                 = 's3'
    }
    [pscustomobject]@{
        Key         = 'jaeger'
        DisplayName = 'Jaeger UI'
        PortSetting = 'JAEGER_HOST_PORT'
        DefaultPort = 16686
    }
    [pscustomobject]@{
        Key         = 'otel-grpc'
        DisplayName = 'OTLP gRPC'
        PortSetting = 'OTEL_GRPC_HOST_PORT'
        DefaultPort = 4317
    }
    [pscustomobject]@{
        Key         = 'otel-http'
        DisplayName = 'OTLP HTTP'
        PortSetting = 'OTEL_HTTP_HOST_PORT'
        DefaultPort = 4318
    }
)

function Write-Step {
    param([Parameter(Mandatory)][string]$Message)
    Write-Host "`n=== $Message ===" -ForegroundColor Cyan
}

function Invoke-Checked {
    param(
        [Parameter(Mandatory)][string]$FilePath,
        [Parameter(Mandatory)][string[]]$Arguments,
        [Parameter(Mandatory)][string]$Description
    )

    Write-Host "> $Description" -ForegroundColor DarkGray
    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Description failed with exit code $LASTEXITCODE."
    }
}

function Assert-File {
    param([Parameter(Mandatory)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "Required file not found: $Path"
    }
}

function Read-DotEnvFile {
    param([Parameter(Mandatory)][string]$Path)

    Assert-File -Path $Path
    $values = [ordered]@{}

    foreach ($rawLine in [System.IO.File]::ReadAllLines($Path)) {
        $line = $rawLine.TrimStart([char]0xFEFF)
        if ([string]::IsNullOrWhiteSpace($line) -or $line.TrimStart().StartsWith('#')) { continue }

        $separator = $line.IndexOf('=')
        if ($separator -le 0) { throw "Unsupported .env line in '$Path': $rawLine" }

        $key = $line.Substring(0, $separator).Trim()
        $value = $line.Substring($separator + 1).Trim()
        if ($value.Length -ge 2 -and
            (($value.StartsWith('"') -and $value.EndsWith('"')) -or
            ($value.StartsWith("'") -and $value.EndsWith("'")))) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        if ([string]::IsNullOrWhiteSpace($key)) { throw "Empty environment variable name in '$Path'." }
        if ($value.Contains("`r") -or $value.Contains("`n")) { throw "Multiline values are not supported in '$Path' (key '$key')." }
        $values[$key] = $value
    }

    return $values
}

function Get-Setting {
    param(
        [Parameter(Mandatory)][string]$Name,
        [AllowNull()][string]$Default = ''
    )
    if ($script:Settings.Contains($Name) -and
        -not [string]::IsNullOrWhiteSpace([string]$script:Settings[$Name])) {
        return ([string]$script:Settings[$Name]).Trim()
    }
    return $Default
}

function Get-RequiredSetting {
    param([Parameter(Mandatory)][string]$Name)
    $value = Get-Setting -Name $Name
    if ([string]::IsNullOrWhiteSpace($value)) { throw "Required setting '$Name' is missing from infra/.env." }
    return $value
}

function Get-BooleanValue {
    param(
        [Parameter(Mandatory)][string]$Value,
        [Parameter(Mandatory)][string]$SettingName
    )
    switch -Regex ($Value.Trim().ToLowerInvariant()) {
        '^(true|1|yes|on)$' { return $true }
        '^(false|0|no|off)$' { return $false }
        default { throw "Setting '$SettingName' must be true/false, 1/0, yes/no or on/off. Current value: '$Value'." }
    }
}

function Get-BooleanSetting {
    param(
        [Parameter(Mandatory)][string]$Name,
        [bool]$Default = $false
    )
    return (Get-BooleanValue -Value (Get-Setting -Name $Name -Default ([string]$Default)) -SettingName $Name)
}

function Get-IntegerSetting {
    param(
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][int]$Default
    )
    $raw = Get-Setting -Name $Name -Default ([string]$Default)
    $parsed = 0
    if (-not [int]::TryParse($raw, [ref]$parsed) -or $parsed -lt 1 -or $parsed -gt 65535) {
        throw "Setting '$Name' must be a valid TCP port (1-65535). Current value: '$raw'."
    }
    return $parsed
}

function Write-TempTextFile {
    param(
        [Parameter(Mandatory)][string]$Content,
        [Parameter(Mandatory)][string]$Suffix
    )
    $path = Join-Path ([System.IO.Path]::GetTempPath()) ("k8s-{0}.{1}" -f [guid]::NewGuid().ToString('N'), $Suffix)
    [System.IO.File]::WriteAllText($path, $Content, [System.Text.UTF8Encoding]::new($false))
    $script:TempFiles.Add($path)
    return $path
}

function Write-DotEnvTempFile {
    param([Parameter(Mandatory)][System.Collections.IDictionary]$Values)
    $lines = foreach ($key in $Values.Keys) {
        $value = [string]$Values[$key]
        if ($value.Contains("`r") -or $value.Contains("`n")) { throw "Multiline value for '$key' cannot be written to a Kubernetes env file." }
        "{0}={1}" -f $key, $value
    }
    return Write-TempTextFile -Content ([string]::Join([Environment]::NewLine, [string[]]$lines)) -Suffix 'env'
}

function Write-JsonTempFile {
    param([Parameter(Mandatory)][System.Collections.IDictionary]$Values)
    $json = ConvertTo-Json -InputObject $Values -Depth 30
    return Write-TempTextFile -Content $json -Suffix 'json'
}

function Apply-GeneratedEnvResource {
    param(
        [Parameter(Mandatory)][ValidateSet('configmap', 'secret')][string]$Kind,
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][string]$EnvFile
    )

    if ($Kind -eq 'secret') {
        $createArgs = @('create', 'secret', 'generic', $Name, '--namespace', $Namespace, "--from-env-file=$EnvFile", '--dry-run=client', '-o', 'yaml')
    }
    else {
        $createArgs = @('create', 'configmap', $Name, '--namespace', $Namespace, "--from-env-file=$EnvFile", '--dry-run=client', '-o', 'yaml')
    }

    $manifest = & kubectl --context $KubeContext @createArgs
    if ($LASTEXITCODE -ne 0) { throw "Could not generate Kubernetes $Kind '$Name' from its env file." }
    $manifest | & kubectl --context $KubeContext apply -f -
    if ($LASTEXITCODE -ne 0) { throw "Could not apply Kubernetes $Kind '$Name'." }
}

function Ensure-KindNodesRunning {
    param([Parameter(Mandatory)][string]$Name)
    $nodes = & kind get nodes --name $Name
    if ($LASTEXITCODE -ne 0) { throw "Could not list nodes for Kind cluster '$Name'." }

    foreach ($node in $nodes) {
        $running = & docker inspect --format '{{.State.Running}}' $node
        if ($LASTEXITCODE -ne 0) { throw "Could not inspect Kind node '$node'." }
        if (($running -join '').Trim() -ne 'true') {
            Write-Host "Starting Kind node: $node" -ForegroundColor Yellow
            Invoke-Checked -FilePath 'docker' -Arguments @('start', $node) -Description "Starting Kind node '$node'"
        }
    }
}

function Test-TcpPort {
    param(
        [Parameter(Mandatory)][string]$ComputerName,
        [Parameter(Mandatory)][int]$Port
    )
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $async = $client.BeginConnect($ComputerName, $Port, $null, $null)
        if (-not $async.AsyncWaitHandle.WaitOne(1000)) { return $false }
        $client.EndConnect($async)
        return $true
    }
    catch { return $false }
    finally { $client.Close() }
}

function Wait-TcpPort {
    param(
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][string]$ComputerName,
        [Parameter(Mandatory)][int]$Port,
        [int]$TimeoutSeconds = 120
    )
    Write-Host "Waiting for $Name at ${ComputerName}:$Port ..." -ForegroundColor DarkGray
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-TcpPort -ComputerName $ComputerName -Port $Port) {
            Write-Host "$Name is reachable." -ForegroundColor Green
            return
        }
        Start-Sleep -Seconds 2
    }
    throw "Timed out waiting for $Name at ${ComputerName}:$Port."
}

function Wait-LocalStackService {
    param(
        [Parameter(Mandatory)][string]$Endpoint,
        [Parameter(Mandatory)][string]$ServiceName,
        [int]$TimeoutSeconds = 180
    )

    Write-Host "Waiting for LocalStack service '$ServiceName' ..." -ForegroundColor DarkGray
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

    while ((Get-Date) -lt $deadline) {
        try {
            $health = Invoke-RestMethod `
                -Uri "$($Endpoint.TrimEnd('/'))/_localstack/health" `
                -TimeoutSec 4

            $serviceProperty = $health.services.PSObject.Properties[$ServiceName]

            if ($null -ne $serviceProperty -and $serviceProperty.Value -eq 'running') {
                Write-Host "LocalStack service '$ServiceName' is running." -ForegroundColor Green
                return
            }
        }
        catch {
            # LocalStack may accept TCP connections before its APIs are ready.
        }
        Start-Sleep -Seconds 3
    }
    throw "Timed out waiting for LocalStack service '$ServiceName'."
}

function Wait-HttpRouteAccepted {
    param(
        [Parameter(Mandatory)][string]$ContextName,
        [Parameter(Mandatory)][string]$TargetNamespace,
        [Parameter(Mandatory)][string]$RouteName,
        [Parameter(Mandatory)][string]$GatewayName,
        [int]$TimeoutSeconds = 120
    )
    Write-Host "Waiting for HTTPRoute '$RouteName' to be accepted ..." -ForegroundColor DarkGray
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    $lastStatus = 'No status reported yet.'

    while ((Get-Date) -lt $deadline) {
        $output = @(& kubectl --context $ContextName get httproute $RouteName --namespace $TargetNamespace -o json 2>&1)
        if ($LASTEXITCODE -ne 0) {
            $details = ($output | ForEach-Object { $_.ToString() }) -join "`n"
            throw "Could not inspect HTTPRoute '$RouteName'. $details"
        }
        try {
            $route = (($output | ForEach-Object { $_.ToString() }) -join "`n") | ConvertFrom-Json -ErrorAction Stop
        }
        catch { throw "Could not parse HTTPRoute '$RouteName' status: $($_.Exception.Message)" }

        $parent = @($route.status.parents | Where-Object { $_.parentRef.name -eq $GatewayName } | Select-Object -First 1)
        if ($parent.Count -gt 0) {
            $conditions = @($parent[0].conditions)
            $accepted = $conditions | Where-Object { $_.type -eq 'Accepted' } | Select-Object -First 1
            $resolved = $conditions | Where-Object { $_.type -eq 'ResolvedRefs' } | Select-Object -First 1
            $acceptedStatus = if ($null -ne $accepted) { $accepted.status } else { 'Missing' }
            $resolvedStatus = if ($null -ne $resolved) { $resolved.status } else { 'Missing' }

            if ($acceptedStatus -eq 'True' -and $resolvedStatus -eq 'True') {
                Write-Host "HTTPRoute '$RouteName' is accepted and references are resolved." -ForegroundColor Green
                return
            }
            $lastStatus = "Accepted=$acceptedStatus; ResolvedRefs=$resolvedStatus"
            if ($null -ne $accepted) { $lastStatus += "; Accepted: $($accepted.reason) $($accepted.message)" }
            if ($null -ne $resolved) { $lastStatus += "; ResolvedRefs: $($resolved.reason) $($resolved.message)" }
        }
        else { $lastStatus = "No status reported for Gateway '$GatewayName'." }
        Start-Sleep -Seconds 2
    }
    throw "Timed out waiting for HTTPRoute '$RouteName'. Last status: $lastStatus"
}

function Ensure-K8sAdminContext {
    param(
        [Parameter(Mandatory)][string]$BootstrapContextName,
        [Parameter(Mandatory)][string]$AdminContextName,
        [Parameter(Mandatory)][string]$AdminAccountName,
        [Parameter(Mandatory)][string]$RbacNamespace,
        [Parameter(Mandatory)][string]$ApplicationNamespace,
        [Parameter(Mandatory)][string]$ClusterName
    )

    $account = & kubectl --context $BootstrapContextName get serviceaccount $AdminAccountName --namespace $RbacNamespace -o name
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace(($account -join ''))) {
        throw "RBAC chart did not create ServiceAccount '$AdminAccountName' in namespace '$RbacNamespace'."
    }

    $token = & kubectl --context $BootstrapContextName create token $AdminAccountName --namespace $RbacNamespace --duration=8h
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace(($token -join ''))) {
        throw "Could not create a fresh token for ServiceAccount '$AdminAccountName'."
    }

    $configJson = & kubectl config view -o json
    if ($LASTEXITCODE -ne 0) { throw 'Could not read kubeconfig.' }
    $config = $configJson | ConvertFrom-Json
    $bootstrapEntry = $config.contexts | Where-Object { $_.name -eq $BootstrapContextName } | Select-Object -First 1
    if ($null -eq $bootstrapEntry) { throw "Kubeconfig context '$BootstrapContextName' was not found." }

    $adminUserReference = "k8s-admin-$ClusterName"
    $tokenValue = ($token -join '').Trim()
    & kubectl config set-credentials $adminUserReference "--token=$tokenValue" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Could not write the refreshed admin token to kubeconfig.' }
    & kubectl config set-context $AdminContextName "--cluster=$($bootstrapEntry.context.cluster)" "--user=$adminUserReference" "--namespace=$ApplicationNamespace" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Could not configure kubeconfig context '$AdminContextName'." }
    Remove-Variable tokenValue, token -ErrorAction SilentlyContinue

    & kubectl --context $AdminContextName auth whoami
    if ($LASTEXITCODE -ne 0) { throw 'The refreshed admin context failed authentication.' }
    $canDeploy = & kubectl --context $AdminContextName auth can-i create deployments --namespace $ApplicationNamespace
    if ($LASTEXITCODE -ne 0 -or (($canDeploy -join '').Trim() -ne 'yes')) {
        throw 'The admin context cannot create Deployments in the application namespace.'
    }
}

function Test-HelmReleaseExists {
    param(
        [Parameter(Mandatory)][string]$ReleaseName,
        [Parameter(Mandatory)][string]$ReleaseNamespace,
        [Parameter(Mandatory)][string]$ContextName
    )
    $filter = '^{0}$' -f [regex]::Escape($ReleaseName)
    $output = @(& helm list --all-namespaces --filter $filter --kube-context $ContextName --output json 2>&1)
    if ($LASTEXITCODE -ne 0) {
        throw "Could not inspect Helm releases: $(($output | ForEach-Object { $_.ToString() }) -join ' ')"
    }
    $json = ($output | ForEach-Object { $_.ToString() }) -join "`n"
    if ([string]::IsNullOrWhiteSpace($json)) { return $false }
    $releases = @(ConvertFrom-Json -InputObject $json -ErrorAction Stop)
    return (@($releases | Where-Object { $_.name -eq $ReleaseName -and $_.namespace -eq $ReleaseNamespace }).Count -gt 0)
}

function Adopt-KubernetesResourceForHelm {
    param(
        [Parameter(Mandatory)][string]$ResourceType,
        [Parameter(Mandatory)][string]$ResourceName,
        [Parameter(Mandatory)][string]$ReleaseName,
        [Parameter(Mandatory)][string]$ReleaseNamespace,
        [Parameter(Mandatory)][string]$ContextName,
        [string]$ResourceNamespace = ''
    )
    $getArgs = @(
        '--context', $ContextName,
        'get', $ResourceType, $ResourceName,
        '--ignore-not-found=true',
        '-o', 'json'
    )
    if ($ResourceNamespace) { $getArgs += @('--namespace', $ResourceNamespace) }
    $resourceJson = & kubectl @getArgs 2>$null
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace(($resourceJson -join ''))) { return }

    $resource = ($resourceJson -join "`n") | ConvertFrom-Json
    $existingRelease = $resource.metadata.annotations.'meta.helm.sh/release-name'
    if (-not [string]::IsNullOrWhiteSpace([string]$existingRelease) -and $existingRelease -ne $ReleaseName) {
        throw "$ResourceType '$ResourceName' is already owned by Helm release '$existingRelease'; refusing to transfer ownership."
    }

    $labelArgs = @('--context', $ContextName, 'label', $ResourceType, $ResourceName, 'app.kubernetes.io/managed-by=Helm', '--overwrite')
    $annotateArgs = @('--context', $ContextName, 'annotate', $ResourceType, $ResourceName,
        "meta.helm.sh/release-name=$ReleaseName", "meta.helm.sh/release-namespace=$ReleaseNamespace", '--overwrite')
    if ($ResourceNamespace) {
        $labelArgs += @('--namespace', $ResourceNamespace)
        $annotateArgs += @('--namespace', $ResourceNamespace)
    }
    Invoke-Checked -FilePath 'kubectl' -Arguments ([string[]]$labelArgs) -Description "Preparing $ResourceType '$ResourceName' for Helm"
    Invoke-Checked -FilePath 'kubectl' -Arguments ([string[]]$annotateArgs) -Description "Adding Helm ownership metadata to $ResourceType '$ResourceName'"
}

function New-ImageReference {
    param(
        [Parameter(Mandatory)][string]$Repository,
        [Parameter(Mandatory)][string]$Tag,
        [string]$Registry = ''
    )
    if ([string]::IsNullOrWhiteSpace($Repository)) { throw 'Image repository cannot be empty.' }
    if ($Registry) { return "{0}/{1}:{2}" -f $Registry.TrimEnd('/'), $Repository, $Tag }
    return "{0}:{1}" -f $Repository, $Tag
}

function Get-ApplicationRegistry {
    param(
        [Parameter(Mandatory)][string]$Registry,
        [Parameter(Mandatory)][string]$FrontendApplication,
        [Parameter(Mandatory)][string]$ProjectName,
        [Parameter(Mandatory)][AllowEmptyCollection()][string[]]$BackendScriptNames
    )

    $applications = [ordered]@{}
    foreach ($entry in $Registry.Split(',')) {
        $parts = $entry.Trim().Split(':')
        if ($parts.Count -ne 2) { throw "Invalid APPLICATIONS entry '$entry'. Expected app-name:port entries separated by commas." }

        $key = $parts[0].Trim().ToLowerInvariant()
        $portText = $parts[1].Trim()
        if ($key -notmatch '^[a-z0-9]([-a-z0-9]*[a-z0-9])?$' -or $key.Length -gt 63) {
            throw "Application key '$key' is not a valid Kubernetes DNS label."
        }
        if ($applications.Contains($key)) { throw "Duplicate application '$key' in APPLICATIONS." }
        $port = 0
        if (-not [int]::TryParse($portText, [ref]$port) -or $port -lt 1 -or $port -gt 65535) {
            throw "Invalid port '$portText' for application '$key'."
        }

        $type = if ($key -eq $FrontendApplication) { 'frontend' } else { 'backend' }

        $migrationScript = "migration:$key:run:prod"
        if ($type -eq 'frontend' -or $BackendScriptNames -notcontains $migrationScript) {
            $migrationScript = ''
        }
        elseif ($type -eq 'backend') {
            Write-Host "Migration script detected for '$key': $migrationScript" -ForegroundColor DarkGray
        }

        $applications[$key] = [pscustomobject]@{
            Key             = $key
            Type            = $type
            Port            = $port
            ReleaseName     = $key
            ImageRepository = "{0}-{1}" -f $ProjectName.ToLowerInvariant(), $key
            BuildArgument   = $key
            MigrationScript = $migrationScript
        }
    }

    if ($applications.Count -eq 0) { throw 'APPLICATIONS must contain at least one app-name:port entry.' }
    if (-not $applications.Contains($FrontendApplication)) {
        Write-Host "Frontend application '$FrontendApplication' is not in APPLICATIONS; frontend deployment and route will be skipped." -ForegroundColor Yellow
    }
    return $applications
}

function Start-BackendHelmReleases {
    param(
        [Parameter(Mandatory)][string]$ChartPath,
        [Parameter(Mandatory)][string]$ContextName,
        [Parameter(Mandatory)][string]$TargetNamespace,
        [Parameter(Mandatory)][string]$ProjectPartOf,
        [Parameter(Mandatory)][string]$PullPolicy,
        [Parameter(Mandatory)][bool]$IsDocker,
        [Parameter(Mandatory)][System.Collections.IDictionary]$ImageReferences,
        [Parameter(Mandatory)][System.Collections.IDictionary]$Applications
    )

    $specs = @()
    foreach ($app in $Applications.Values | Where-Object { $_.Type -eq 'backend' }) {
        $helmArguments = @(
            'upgrade', '--install', $app.ReleaseName, $ChartPath, '--reset-values',
            '--kube-context', $ContextName, '--namespace', $TargetNamespace,
            '--set-string', "app.image=$($ImageReferences[$app.Key])",
            '--set', "app.port=$($app.Port)",
            '--set-string', "app.imagePullPolicy=$PullPolicy",
            '--set', "app.isDocker=$($IsDocker.ToString().ToLowerInvariant())",
            '--set-string', "partOf=$ProjectPartOf",
            '--set-string', 'config.configMapName=backend-config',
            '--set-string', 'config.secretName=backend-secrets'
        )

        if ($app.MigrationScript) {
            $helmArguments += @(
                '--set', 'migration.enabled=true',
                '--set-string', 'migration.command[0]=npm',
                '--set-string', 'migration.command[1]=run',
                '--set-string', "migration.command[2]=$($app.MigrationScript)"
            )
        }
        else {
            $helmArguments += @('--set', 'migration.enabled=false')
        }
        $helmArguments += @('--wait', '--timeout', '5m')
        $specs += [pscustomobject]@{ Name = $app.ReleaseName; Arguments = [string[]]$helmArguments }
    }

    if ($specs.Count -eq 0) {
        Write-Host 'No backend applications configured; skipping backend chart deployment.' -ForegroundColor Yellow
        return
    }

    Write-Step 'Deploying backend applications and running available migration hooks'
    $jobs = @()
    foreach ($spec in $specs) {
        $jobs += Start-Job -Name "helm-$($spec.Name)" -ArgumentList (, $spec.Arguments) -ScriptBlock {
            param([string[]]$HelmArguments)
            $output = @(& helm @HelmArguments 2>&1 | ForEach-Object { $_.ToString() })
            [pscustomobject]@{ ExitCode = $LASTEXITCODE; Output = $output }
        }
    }

    try {
        $null = $jobs | Wait-Job
        $failed = $false
        foreach ($job in $jobs) {
            $results = @(Receive-Job -Job $job)
            $result = $results | Where-Object { $_.PSObject.Properties.Name -contains 'ExitCode' } | Select-Object -Last 1
            Write-Host "`n--- Helm release: $($job.Name) ---" -ForegroundColor Cyan
            if ($null -eq $result) {
                foreach ($line in $results) { Write-Host $line }
                Write-Host "Release $($job.Name) did not return an exit status." -ForegroundColor Red
                $failed = $true
            }
            else {
                foreach ($line in $result.Output) { Write-Host $line }
                if ([int]$result.ExitCode -ne 0) {
                    Write-Host "Release $($job.Name) failed (exit $($result.ExitCode))." -ForegroundColor Red
                    $failed = $true
                }
            }
            if ($job.State -ne 'Completed') { $failed = $true }
        }
        if ($failed) { throw 'At least one backend Helm release failed. Inspect the release output above before retrying.' }
    }
    finally {
        if ($jobs.Count -gt 0) { $jobs | Remove-Job -Force -ErrorAction SilentlyContinue }
    }
}

try {
    Write-Step 'Loading infrastructure configuration'
    $InfraEnvFile = Join-Path $InfraDir '.env'
    $InfraSecretsFile = Join-Path $InfraDir '.env.secrets'
    $BackendDir = Join-Path $ProjectRoot 'backend'
    $BackendEnvFile = Join-Path $BackendDir '.env'
    $BackendSecretsFile = Join-Path $BackendDir '.env.secrets'
    $BackendPackageFile = Join-Path $BackendDir 'package.json'
    $BackendDockerfile = Join-Path $BackendDir 'Dockerfile'
    $FrontendDir = Join-Path $ProjectRoot 'frontend'
    $FrontendDockerfile = Join-Path $FrontendDir 'Dockerfile'

    $script:Settings = Read-DotEnvFile -Path $InfraEnvFile
    $infraSecrets = Read-DotEnvFile -Path $InfraSecretsFile
    foreach ($key in $infraSecrets.Keys) {
        $script:Settings[$key] = $infraSecrets[$key]
    }

    $ProjectName = Get-RequiredSetting -Name 'PROJECT_NAME'
    if ($ProjectName -notmatch '^[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?$') {
        throw "PROJECT_NAME '$ProjectName' contains characters unsuitable for image repository naming. Use letters, digits, dots, underscores or hyphens."
    }
    $InfrastructureMode = (Get-Setting -Name 'INFRASTRUCTURE_MODE' -Default 'compose').ToLowerInvariant()
    $K8sDistribution = (Get-Setting -Name 'K8S_DISTRIBUTION' -Default 'kind').ToLowerInvariant()
    if ($InfrastructureMode -notin @('compose', 'external')) { throw "INFRASTRUCTURE_MODE must be 'compose' or 'external'." }
    if ($K8sDistribution -notin @('kind', 'k3s')) { throw "K8S_DISTRIBUTION must be 'kind' or 'k3s'." }

    $NamespaceManifest = Join-Path $K8sDir 'bootstrap\namespace.yaml'
    $KindConfig = Join-Path $K8sDir 'providers\kind\cluster-config.yaml'
    $ComposeFile = Join-Path $InfraDir 'docker-compose.yml'
    $BackendChart = Join-Path $K8sDir 'charts\backend'
    $FrontendChart = Join-Path $K8sDir 'charts\frontend'
    $GatewayChart = Join-Path $K8sDir 'charts\gateway'
    $RbacChart = Join-Path $K8sDir 'charts\rbac'
    $NgfValues = Join-Path $K8sDir 'addons\nginx-gateway-fabric\values.yaml'

    foreach ($path in @(
            $InfraSecretsFile, $NamespaceManifest,
            (Join-Path $BackendChart 'Chart.yaml'), (Join-Path $FrontendChart 'Chart.yaml'),
            (Join-Path $GatewayChart 'Chart.yaml'), (Join-Path $RbacChart 'Chart.yaml'), $NgfValues
        )) { Assert-File -Path $path }

    $namespaceText = Get-Content -LiteralPath $NamespaceManifest -Raw
    $namespaceMatch = [regex]::Match($namespaceText, '(?ms)^metadata:\s*\r?\n\s+name:\s*([^\s#]+)')
    if (-not $namespaceMatch.Success) { throw "Could not determine Namespace from '$NamespaceManifest'." }
    $Namespace = $namespaceMatch.Groups[1].Value.Trim([char[]]@('"', "'"))
    $configuredNamespace = Get-Setting -Name 'K8S_NAMESPACE' -Default $Namespace
    if ($configuredNamespace -ne $Namespace) { throw "K8S_NAMESPACE='$configuredNamespace' does not match '$Namespace' in the static Namespace manifest." }

    $ClusterName = Get-Setting -Name 'K8S_CLUSTER_NAME' -Default "$ProjectName-local"
    $ExpectedKindContext = "kind-$ClusterName"
    $ConfiguredContext = Get-Setting -Name 'K8S_CONTEXT' -Default ''
    if ($K8sDistribution -eq 'kind') {
        $BootstrapContext = $ExpectedKindContext
        if ($ConfiguredContext -and $ConfiguredContext -ne $BootstrapContext) {
            throw "K8S_CONTEXT='$ConfiguredContext' does not match Kind context '$BootstrapContext'."
        }
        $AdminContext = "k8s-admin@$ClusterName"
    }
    else {
        if (-not $ConfiguredContext) { throw 'K8S_CONTEXT is required when K8S_DISTRIBUTION=k3s.' }
        $BootstrapContext = $ConfiguredContext
        $AdminContext = $ConfiguredContext
    }
    $KubeContext = $AdminContext
    $K8sCreateCluster = Get-BooleanSetting -Name 'K8S_CREATE_CLUSTER' -Default ($K8sDistribution -eq 'kind')

    $FrontendApplication = (Get-Setting -Name 'FRONTEND_APPLICATION' -Default 'frontend').ToLowerInvariant()
    $IsDocker = Get-BooleanSetting -Name 'IS_DOCKER' -Default $true
    $AppHealthPath = Get-Setting -Name 'APP_HEALTH_PATH' -Default '/health/live'
    if ($AppHealthPath -notmatch '^/[A-Za-z0-9/_-]*$') {
        throw "Invalid APP_HEALTH_PATH: '$AppHealthPath'."
    }

    Assert-File -Path $BackendPackageFile
    $backendPackage = Get-Content -LiteralPath $BackendPackageFile -Raw | ConvertFrom-Json
    $backendScriptNames = @()
    if ($null -ne $backendPackage.scripts) {
        $backendScriptNames = @($backendPackage.scripts.PSObject.Properties | ForEach-Object { $_.Name })
    }
    $Applications = Get-ApplicationRegistry `
        -Registry (Get-RequiredSetting -Name 'APPLICATIONS') `
        -FrontendApplication $FrontendApplication `
        -ProjectName $ProjectName `
        -BackendScriptNames $backendScriptNames

    $BackendApplications = @($Applications.Values | Where-Object { $_.Type -eq 'backend' })
    $FrontendApp = $null
    if ($Applications.Contains($FrontendApplication)) { $FrontendApp = $Applications[$FrontendApplication] }

    $GatewayName = Get-Setting -Name 'GATEWAY_NAME' -Default 'gateway'
    $GatewayClass = Get-Setting -Name 'GATEWAY_CLASS' -Default 'nginx'
    $GatewayHttpPort = Get-IntegerSetting -Name 'GATEWAY_HTTP_PORT' -Default 80
    $GatewayHostPort = Get-IntegerSetting -Name 'GATEWAY_HOST_PORT' -Default 8081
    $RbacNamespace = Get-Setting -Name 'RBAC_NAMESPACE' -Default 'k8s-access'
    $RbacAdminAccount = Get-Setting -Name 'RBAC_ADMIN_ACCOUNT' -Default 'k8s-admin'
    $RbacViewerAccount = Get-Setting -Name 'RBAC_VIEWER_ACCOUNT' -Default 'k8s-viewer'
    $NgfReleaseName = Get-Setting -Name 'NGF_RELEASE_NAME' -Default 'ngf'
    $NgfNamespace = Get-Setting -Name 'NGF_NAMESPACE' -Default 'nginx-gateway'
    $NgfVersion = Get-Setting -Name 'NGF_CHART_VERSION' -Default '2.8.0'
    $ImageRegistry = Get-Setting -Name 'IMAGE_REGISTRY' -Default ''
    $ImageTag = Get-Setting -Name 'IMAGE_TAG' -Default 'latest'
    $defaultImagePullPolicy = 'IfNotPresent'
    if ($K8sDistribution -eq 'kind') { $defaultImagePullPolicy = 'Never' }
    $ImagePullPolicy = Get-Setting -Name 'IMAGE_PULL_POLICY' -Default $defaultImagePullPolicy

    $InfrastructureServices = @(
        foreach ($definition in $InfrastructureRegistry) {
            [pscustomobject]@{
                Key                           = $definition.Key
                DisplayName                   = $definition.DisplayName
                HostPort                      = Get-IntegerSetting `
                    -Name $definition.PortSetting `
                    -Default $definition.DefaultPort

                BackendConfigKey              = $definition.BackendConfigKey
                BackendConfigEndpointTemplate = $definition.BackendConfigEndpointTemplate

                BackendSecretKey              = $definition.BackendSecretKey
                ComposeEndpoint               = $definition.ComposeEndpoint
                ClusterEndpointTemplate       = $definition.ClusterEndpointTemplate

                HealthService                 = $definition.HealthService
            }
        }
    )

    Write-Host "Project:             $ProjectName" -ForegroundColor Gray
    Write-Host "Applications:        $($Applications.Keys -join ', ')" -ForegroundColor Gray
    Write-Host "Infrastructure mode: $InfrastructureMode" -ForegroundColor Gray
    Write-Host "Kubernetes:          $K8sDistribution" -ForegroundColor Gray
    Write-Host "Namespace:           $Namespace" -ForegroundColor Gray
    Write-Host "Bootstrap context:   $BootstrapContext" -ForegroundColor Gray
    Write-Host "Deployment context:  $KubeContext" -ForegroundColor Gray

    Write-Step 'Checking required tools'
    $requiredTools = @('kubectl', 'helm')
    if ($K8sDistribution -eq 'kind' -or $InfrastructureMode -eq 'compose') { $requiredTools += 'docker' }
    if ($K8sDistribution -eq 'kind') { $requiredTools += 'kind' }
    foreach ($tool in ($requiredTools | Select-Object -Unique)) {
        if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "Required command '$tool' was not found in PATH." }
    }

    if ($InfrastructureMode -eq 'compose') {
        Assert-File -Path $ComposeFile
        Write-Step 'Starting local infrastructure through Docker Compose'
        Invoke-Checked -FilePath 'docker' -Arguments @(
            'compose', '--env-file', $InfraEnvFile, '--env-file', $InfraSecretsFile,
            '--project-directory', $InfraDir, '-f', $ComposeFile, 'up', '-d'
        ) -Description 'Starting local infrastructure services'

        foreach ($service in $InfrastructureServices) {
            Wait-TcpPort `
                -Name $service.DisplayName `
                -ComputerName '127.0.0.1' `
                -Port $service.HostPort

            if ($service.HealthService) {
                Wait-LocalStackService `
                    -Endpoint "http://127.0.0.1:$($service.HostPort)" `
                    -ServiceName $service.HealthService
            }
        }
    }
    else {
        Write-Step 'Using externally managed infrastructure'
    }

    Write-Step 'Preparing Kubernetes cluster access'
    if ($K8sDistribution -eq 'kind') {
        Assert-File -Path $KindConfig
        if ($GatewayHttpPort -ne 80) { throw 'With the current Kind NginxProxy, GATEWAY_HTTP_PORT must remain 80. GATEWAY_HOST_PORT is the workstation port.' }
        $kindConfigText = Get-Content -LiteralPath $KindConfig -Raw
        if ($kindConfigText -notmatch "(?m)^\s*hostPort:\s*$GatewayHostPort\s*$") {
            throw "GATEWAY_HOST_PORT=$GatewayHostPort does not match a hostPort in '$KindConfig'. Update the static Kind config manually if needed."
        }
        Invoke-Checked -FilePath 'docker' -Arguments @('info', '--format', '{{.ServerVersion}}') -Description 'Checking Docker Engine'
        $clusters = & kind get clusters
        if ($LASTEXITCODE -ne 0) { throw 'Could not list Kind clusters.' }
        if ($clusters -notcontains $ClusterName) {
            if (-not $K8sCreateCluster) { throw "Kind cluster '$ClusterName' does not exist and K8S_CREATE_CLUSTER is false." }
            Invoke-Checked -FilePath 'kind' -Arguments @('create', 'cluster', '--name', $ClusterName, '--config', $KindConfig) -Description "Creating Kind cluster '$ClusterName'"
        }
        else { Ensure-KindNodesRunning -Name $ClusterName }
        Invoke-Checked -FilePath 'kind' -Arguments @('export', 'kubeconfig', '--name', $ClusterName) -Description 'Exporting Kind kubeconfig'
    }
    else {
        $contexts = & kubectl config get-contexts -o name
        if ($LASTEXITCODE -ne 0 -or $contexts -notcontains $BootstrapContext) { throw "Kubeconfig context '$BootstrapContext' was not found." }
    }
    Invoke-Checked -FilePath 'kubectl' -Arguments @('--context', $BootstrapContext, 'wait', '--for=condition=Ready', 'nodes', '--all', '--timeout=180s') -Description 'Waiting for Kubernetes nodes to become Ready'

    Write-Step 'Applying the application Namespace'
    Invoke-Checked -FilePath 'kubectl' -Arguments @('--context', $BootstrapContext, 'apply', '-f', $NamespaceManifest) -Description "Applying Namespace '$Namespace'"

    Write-Step 'Preparing existing RBAC resources for Helm management'
    if (-not (Test-HelmReleaseExists -ReleaseName 'rbac' -ReleaseNamespace $RbacNamespace -ContextName $BootstrapContext)) {
        $legacyRbacResources = @(
            [pscustomobject]@{ Type = 'serviceaccount'; Name = $RbacAdminAccount; Namespace = $RbacNamespace },
            [pscustomobject]@{ Type = 'serviceaccount'; Name = $RbacViewerAccount; Namespace = $RbacNamespace },
            [pscustomobject]@{ Type = 'clusterrole'; Name = 'k8s-cluster-reader'; Namespace = '' },
            [pscustomobject]@{ Type = 'clusterrolebinding'; Name = 'k8s-admin-binding'; Namespace = '' },
            [pscustomobject]@{ Type = 'clusterrolebinding'; Name = 'k8s-viewer-view-binding'; Namespace = '' },
            [pscustomobject]@{ Type = 'clusterrolebinding'; Name = 'k8s-viewer-cluster-reader-binding'; Namespace = '' }
        )
        foreach ($resource in $legacyRbacResources) {
            Adopt-KubernetesResourceForHelm -ResourceType $resource.Type -ResourceName $resource.Name `
                -ReleaseName 'rbac' -ReleaseNamespace $RbacNamespace -ContextName $BootstrapContext `
                -ResourceNamespace $resource.Namespace
        }
    }

    Write-Step 'Installing/upgrading RBAC'
    Invoke-Checked -FilePath 'helm' -Arguments @(
        'upgrade', '--install', 'rbac', $RbacChart, '--reset-values',
        '--kube-context', $BootstrapContext, '--namespace', $RbacNamespace, '--create-namespace',
        '--set-string', "serviceAccounts.admin.name=$RbacAdminAccount",
        '--set-string', "serviceAccounts.viewer.name=$RbacViewerAccount",
        '--set-string', "partOf=$ProjectName", '--wait', '--timeout', '5m'
    ) -Description 'Installing/upgrading RBAC chart'

    if ($K8sDistribution -eq 'kind') {
        Write-Step 'Creating the short-lived Kind admin context'
        Ensure-K8sAdminContext -BootstrapContextName $BootstrapContext -AdminContextName $AdminContext `
            -AdminAccountName $RbacAdminAccount -RbacNamespace $RbacNamespace `
            -ApplicationNamespace $Namespace -ClusterName $ClusterName
    }
    else { $KubeContext = $BootstrapContext }

    if ($BackendApplications.Count -gt 0) {
        Assert-File -Path $BackendEnvFile
        Assert-File -Path $BackendSecretsFile
        Write-Step 'Generating backend ConfigMap and Secret'
        $backendConfig = Read-DotEnvFile -Path $BackendEnvFile
        $backendSecrets = Read-DotEnvFile -Path $BackendSecretsFile
        if ($K8sDistribution -eq 'kind' -and $InfrastructureMode -eq 'compose') {
            foreach ($service in $InfrastructureServices) {
                if ($service.BackendConfigKey -and
                    $backendConfig.Contains($service.BackendConfigKey)) {

                    $backendConfig[$service.BackendConfigKey] = (
                        $service.BackendConfigEndpointTemplate -f $service.HostPort
                    )
                }
                if ($service.BackendSecretKey) {
                    if (-not $backendSecrets.Contains($service.BackendSecretKey)) {
                        throw "Required backend secret '$($service.BackendSecretKey)' is missing."
                    }
                    $backendSecrets[$service.BackendSecretKey] = (
                        [string]$backendSecrets[$service.BackendSecretKey]
                    ).Replace(
                        $service.ComposeEndpoint,
                        ($service.ClusterEndpointTemplate -f $service.HostPort)
                    )
                }
            }
        }
        $configTemp = Write-DotEnvTempFile -Values $backendConfig
        $secretsTemp = Write-DotEnvTempFile -Values $backendSecrets
        try {
            Apply-GeneratedEnvResource -Kind configmap -Name 'backend-config' -EnvFile $configTemp
            Apply-GeneratedEnvResource -Kind secret -Name 'backend-secrets' -EnvFile $secretsTemp
        }
        finally {
            foreach ($path in @($configTemp, $secretsTemp)) {
                if (Test-Path -LiteralPath $path) { Remove-Item -LiteralPath $path -Force }
                $TempFiles.Remove($path) | Out-Null
            }
        }
    }

    if ($K8sDistribution -eq 'kind') {
        if ($BackendApplications.Count -gt 0) {
            Assert-File -Path $BackendDockerfile
            $dockerIgnorePath = Join-Path $BackendDir '.dockerignore'
            Assert-File -Path $dockerIgnorePath
            $ignoreRules = [System.IO.File]::ReadAllLines($dockerIgnorePath) | ForEach-Object { $_.Trim() }
            if (-not (@($ignoreRules | Where-Object { $_ -in @('.env.secrets', '.env.*', '**/.env.*', '.env*', '**/.env*') }).Count -gt 0)) {
                throw "backend/.dockerignore must exclude .env.secrets (for example, add '.env.*')."
            }
        }
        if ($null -ne $FrontendApp) { Assert-File -Path $FrontendDockerfile }
        $ImageTag = 'local-{0}-{1}' -f (Get-Date).ToUniversalTime().ToString('yyyyMMddHHmmss'), ([guid]::NewGuid().ToString('N').Substring(0, 8))
    }
    elseif ([string]::IsNullOrWhiteSpace($ImageTag)) { throw 'IMAGE_TAG must be set when deploying to k3s.' }

    $ImageReferences = [ordered]@{}
    foreach ($app in $Applications.Values) {
        $ImageReferences[$app.Key] = New-ImageReference -Repository $app.ImageRepository -Tag $ImageTag -Registry $ImageRegistry
    }
    Write-Host "Image tag: $ImageTag" -ForegroundColor DarkGray
    Write-Host "Image pull policy: $ImagePullPolicy" -ForegroundColor DarkGray

    if ($K8sDistribution -eq 'kind') {
        Write-Step 'Building selected application images'
        foreach ($app in $BackendApplications) {
            Invoke-Checked -FilePath 'docker' -Arguments @(
                'build', '--build-arg', "APP_NAME=$($app.BuildArgument)",
                '-f', $BackendDockerfile, '-t', $ImageReferences[$app.Key], $BackendDir
            ) -Description "Building $($ImageReferences[$app.Key])"
        }
        if ($null -ne $FrontendApp) {
            Invoke-Checked -FilePath 'docker' -Arguments @('build', '-f', $FrontendDockerfile, '-t', $ImageReferences[$FrontendApp.Key], $FrontendDir) `
                -Description "Building $($ImageReferences[$FrontendApp.Key])"
        }
        $imagesToLoad = @($ImageReferences.Values)
        if ($imagesToLoad.Count -gt 0) {
            Invoke-Checked -FilePath 'kind' -Arguments (@('load', 'docker-image') + $imagesToLoad + @('--name', $ClusterName)) `
                -Description 'Loading application images into Kind'
        }
    }
    else {
        Write-Step 'Skipping local image builds for k3s'
        Write-Host 'Images must be available from IMAGE_REGISTRY or already present on target nodes.' -ForegroundColor Gray
    }

    Write-Step 'Installing Gateway API CRDs'
    $crdRef = "v$NgfVersion"
    $crdUrl = "https://github.com/nginx/nginx-gateway-fabric/config/crd/gateway-api/standard?ref=$crdRef"
    $crdManifest = & kubectl kustomize $crdUrl
    if ($LASTEXITCODE -ne 0) { throw "Could not render Gateway API CRDs from NGINX Gateway Fabric release '$crdRef'." }
    $crdManifest | & kubectl --context $KubeContext apply -f -
    if ($LASTEXITCODE -ne 0) { throw 'Could not apply Gateway API CRDs.' }
    Invoke-Checked -FilePath 'kubectl' -Arguments @(
        '--context', $KubeContext, 'wait', '--for=condition=Established', '--timeout=120s',
        'crd/gatewayclasses.gateway.networking.k8s.io', 'crd/gateways.gateway.networking.k8s.io',
        'crd/httproutes.gateway.networking.k8s.io'
    ) -Description 'Waiting for Gateway API CRDs'

    Write-Step 'Installing/upgrading NGINX Gateway Fabric'
    Invoke-Checked -FilePath 'helm' -Arguments @(
        'upgrade', '--install', $NgfReleaseName, 'oci://ghcr.io/nginx/charts/nginx-gateway-fabric',
        '--version', $NgfVersion, '--kube-context', $KubeContext,
        '--namespace', $NgfNamespace, '--create-namespace', '--values', $NgfValues,
        '--set-string', "nginxGateway.gatewayClassName=$GatewayClass", '--wait', '--timeout', '5m'
    ) -Description 'Installing/upgrading NGINX Gateway Fabric'
    Invoke-Checked -FilePath 'kubectl' -Arguments @(
        '--context', $KubeContext, 'wait', '--for=condition=Accepted', "gatewayclass/$GatewayClass", '--timeout=120s'
    ) -Description "Waiting for GatewayClass '$GatewayClass' to be accepted"

    if ($BackendApplications.Count -gt 0) {
        Start-BackendHelmReleases -ChartPath $BackendChart -ContextName $KubeContext -TargetNamespace $Namespace `
            -ProjectPartOf $ProjectName -PullPolicy $ImagePullPolicy -IsDocker $IsDocker -ImageReferences $ImageReferences -Applications $Applications
    }

    if ($null -ne $FrontendApp) {
        Write-Step 'Deploying frontend application'
        Invoke-Checked -FilePath 'helm' -Arguments @(
            'upgrade', '--install', $FrontendApp.ReleaseName, $FrontendChart, '--reset-values',
            '--kube-context', $KubeContext, '--namespace', $Namespace,
            '--set-string', "app.image=$($ImageReferences[$FrontendApp.Key])",
            '--set-string', "app.imagePullPolicy=$ImagePullPolicy",
            '--set', "app.port=$($FrontendApp.Port)", '--set-string', "partOf=$ProjectName",
            '--wait', '--timeout', '5m'
        ) -Description "Installing/upgrading frontend release '$($FrontendApp.ReleaseName)'"
    }

    Write-Step 'Preparing Gateway values from the application registry'
    $gatewayBackendServices = [ordered]@{}
    foreach ($app in $BackendApplications) {
        $gatewayBackendServices[$app.Key] = [ordered]@{ name = $app.ReleaseName; port = $app.Port }
    }
    $gatewayServices = [ordered]@{ backend = $gatewayBackendServices }
    if ($null -ne $FrontendApp) { $gatewayServices.frontend = [ordered]@{ name = $FrontendApp.ReleaseName; port = $FrontendApp.Port } }

    $gatewayOverrides = [ordered]@{
        partOf   = $ProjectName
        gateway  = [ordered]@{
            name      = $GatewayName
            className = $GatewayClass
            listener  = [ordered]@{ port = $GatewayHttpPort }
        }
        services = $gatewayServices
        routes   = [ordered]@{
            backend  = [ordered]@{ enabled = ($BackendApplications.Count -gt 0) }
            frontend = [ordered]@{ enabled = ($null -ne $FrontendApp) }
        }
    }
    if ($K8sDistribution -eq 'k3s') {
        $gatewayServiceType = Get-Setting -Name 'GATEWAY_SERVICE_TYPE' -Default 'LoadBalancer'
        $gatewayOverrides.nginxProxy = [ordered]@{
            spec = [ordered]@{
                kubernetes = [ordered]@{
                    service    = [ordered]@{ type = $gatewayServiceType }
                    deployment = [ordered]@{ container = [ordered]@{ hostPorts = @() } }
                }
            }
        }
    }
    $gatewayValuesTemp = Write-JsonTempFile -Values $gatewayOverrides
    try {
        Write-Step 'Installing/upgrading the Gateway Helm release'
        Invoke-Checked -FilePath 'helm' -Arguments @(
            'upgrade', '--install', $GatewayName, $GatewayChart, '--reset-values',
            '--kube-context', $KubeContext, '--namespace', $Namespace,
            '--values', $gatewayValuesTemp, '--wait', '--timeout', '5m'
        ) -Description 'Installing/upgrading Gateway, NginxProxy and HTTPRoutes'
    }
    finally {
        if (Test-Path -LiteralPath $gatewayValuesTemp) { Remove-Item -LiteralPath $gatewayValuesTemp -Force }
        $TempFiles.Remove($gatewayValuesTemp) | Out-Null
    }

    Invoke-Checked -FilePath 'kubectl' -Arguments @(
        '--context', $KubeContext, 'wait', '--for=condition=Programmed', "gateway/$GatewayName",
        '--namespace', $Namespace, '--timeout=180s'
    ) -Description "Waiting for Gateway '$GatewayName' to be Programmed"
    Invoke-Checked -FilePath 'kubectl' -Arguments @(
        '--context', $KubeContext, 'wait', '--for=condition=Available', "deployment/$GatewayName-nginx",
        '--namespace', $Namespace, '--timeout=180s'
    ) -Description 'Waiting for NGINX data plane'

    if ($BackendApplications.Count -gt 0) {
        Wait-HttpRouteAccepted -ContextName $KubeContext -TargetNamespace $Namespace `
            -RouteName 'backend-routes' -GatewayName $GatewayName -TimeoutSeconds 120
    }
    if ($null -ne $FrontendApp) {
        Wait-HttpRouteAccepted -ContextName $KubeContext -TargetNamespace $Namespace `
            -RouteName 'frontend-route' -GatewayName $GatewayName -TimeoutSeconds 120
    }

    $GatewayBaseUrl = Get-Setting -Name 'GATEWAY_BASE_URL' -Default ''
    if ($K8sDistribution -eq 'kind') { $GatewayBaseUrl = "http://127.0.0.1:$GatewayHostPort" }
    if ($GatewayBaseUrl) {
        Write-Step 'Verifying Gateway entry point and application health'
        if ($K8sDistribution -eq 'kind') { Wait-TcpPort -Name 'NGINX Gateway HTTP' -ComputerName '127.0.0.1' -Port $GatewayHostPort }

        if ($null -ne $FrontendApp) {
            $frontendResponse = Invoke-WebRequest -Uri "$($GatewayBaseUrl.TrimEnd('/'))/" -TimeoutSec 20 -UseBasicParsing
            if ([int]$frontendResponse.StatusCode -ne 200) { throw "Frontend returned HTTP $($frontendResponse.StatusCode)." }
            Write-Host 'Frontend: HTTP 200' -ForegroundColor Green
        }
        foreach ($app in $BackendApplications) {
            $healthUrl = "$($GatewayBaseUrl.TrimEnd('/'))/api/$($app.Key)$AppHealthPath"
            $response = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 15
            if ($response.status -ne 'ok') {
                throw "Health check failed for '$($app.Key)' at '$healthUrl'."
            }
            Write-Host "$($app.Key): HTTP health OK" -ForegroundColor Green
        }
    }
    else {
        Write-Host 'GATEWAY_BASE_URL is not configured; external HTTP health checks are skipped.' -ForegroundColor Yellow
    }

    Write-Step 'Environment is ready'
    if ($GatewayBaseUrl) { Write-Host "Gateway:   $GatewayBaseUrl" -ForegroundColor Green }
    Write-Host "Namespace: $Namespace" -ForegroundColor Green
    Write-Host "Context:   $KubeContext" -ForegroundColor Green
    Write-Host "NGF:       $NgfReleaseName ($NgfVersion)" -ForegroundColor Green
}
catch {
    Write-Host "`nUP FAILED: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host 'Existing resources were not automatically deleted.' -ForegroundColor Yellow
    exit 1
}
finally {
    foreach ($path in @($TempFiles)) {
        if (Test-Path -LiteralPath $path) { Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue }
    }
}
