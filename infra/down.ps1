[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

# down.ps1 lives in infra/. Resolve paths from this file, not the caller's
# current working directory.
$InfraDir = (Resolve-Path $PSScriptRoot).Path
$ProjectRoot = (Resolve-Path (Join-Path $InfraDir '..')).Path
$K8sDir = Join-Path $InfraDir 'k8s'

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
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw "$Description failed with exit code $exitCode."
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
        if ([string]::IsNullOrWhiteSpace($line) -or $line.TrimStart().StartsWith('#')) {
            continue
        }

        $separator = $line.IndexOf('=')
        if ($separator -le 0) {
            throw "Unsupported .env line in '$Path': $rawLine"
        }

        $key = $line.Substring(0, $separator).Trim()
        $value = $line.Substring($separator + 1).Trim()
        if ($value.Length -ge 2 -and
            (($value.StartsWith('"') -and $value.EndsWith('"')) -or
             ($value.StartsWith("'") -and $value.EndsWith("'")))) {
            $value = $value.Substring(1, $value.Length - 2)
        }

        if ([string]::IsNullOrWhiteSpace($key)) {
            throw "Empty environment variable name in '$Path'."
        }
        if ($value.Contains("`r") -or $value.Contains("`n")) {
            throw "Multiline values are not supported in '$Path' (key '$key')."
        }
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
    if ([string]::IsNullOrWhiteSpace($value)) {
        throw "Required setting '$Name' is missing from infra/.env."
    }
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
        default {
            throw "Setting '$SettingName' must be true/false, 1/0, yes/no or on/off. Current value: '$Value'."
        }
    }
}

function Get-BooleanSetting {
    param(
        [Parameter(Mandatory)][string]$Name,
        [bool]$Default = $false
    )

    return (Get-BooleanValue `
        -Value (Get-Setting -Name $Name -Default ([string]$Default)) `
        -SettingName $Name)
}

function Get-ApplicationReleaseNames {
    param([Parameter(Mandatory)][string]$Registry)

    $releaseNames = [System.Collections.Generic.List[string]]::new()
    foreach ($entry in $Registry.Split(',')) {
        $parts = $entry.Trim().Split(':')
        if ($parts.Count -ne 2) {
            throw "Invalid APPLICATIONS entry '$entry'. Expected app-name:port entries separated by commas."
        }

        $name = $parts[0].Trim().ToLowerInvariant()
        $portText = $parts[1].Trim()
        $port = 0

        if ($name -notmatch '^[a-z0-9]([-a-z0-9]*[a-z0-9])?$' -or $name.Length -gt 63) {
            throw "Application key '$name' is not a valid Kubernetes DNS label."
        }
        if ($releaseNames.Contains($name)) {
            throw "Duplicate application '$name' in APPLICATIONS."
        }
        if (-not [int]::TryParse($portText, [ref]$port) -or $port -lt 1 -or $port -gt 65535) {
            throw "Invalid port '$portText' for application '$name'."
        }

        # up.ps1 uses the application key as the Helm release name.
        $releaseNames.Add($name)
    }

    if ($releaseNames.Count -eq 0) {
        throw 'APPLICATIONS must contain at least one app-name:port entry.'
    }

    return $releaseNames.ToArray()
}

function Test-HelmReleaseExists {
    param(
        [Parameter(Mandatory)][string]$ReleaseName,
        [Parameter(Mandatory)][string]$ReleaseNamespace,
        [Parameter(Mandatory)][string]$ContextName
    )

    $releaseFilter = '^{0}$' -f [regex]::Escape($ReleaseName)
    $output = @(
        & helm list --all-namespaces --filter $releaseFilter `
            --kube-context $ContextName --output json 2>&1
    )
    $exitCode = $LASTEXITCODE

    if ($exitCode -ne 0) {
        $details = ($output | ForEach-Object { $_.ToString() }) -join "`n"
        throw "Could not inspect Helm releases. Exit code: $exitCode. $details"
    }

    $jsonText = ($output | ForEach-Object { $_.ToString() }) -join "`n"
    if ([string]::IsNullOrWhiteSpace($jsonText)) {
        return $false
    }

    try {
        $releases = @(ConvertFrom-Json -InputObject $jsonText -ErrorAction Stop)
    }
    catch {
        throw "Invalid JSON returned by Helm: $($_.Exception.Message)"
    }

    return (@(
        $releases | Where-Object {
            $_.name -eq $ReleaseName -and $_.namespace -eq $ReleaseNamespace
        }
    ).Count -gt 0)
}

function Remove-HelmRelease {
    param(
        [Parameter(Mandatory)][string]$ReleaseName,
        [Parameter(Mandatory)][string]$ReleaseNamespace,
        [Parameter(Mandatory)][string]$ContextName,
        [Parameter(Mandatory)][string]$Description
    )

    if (-not (Test-HelmReleaseExists `
        -ReleaseName $ReleaseName `
        -ReleaseNamespace $ReleaseNamespace `
        -ContextName $ContextName)) {
        Write-Host "Helm release '$ReleaseName' is not installed; skipping." -ForegroundColor Yellow
        return
    }

    Invoke-Checked -FilePath 'helm' -Arguments @(
        'uninstall', $ReleaseName,
        '--kube-context', $ContextName,
        '--namespace', $ReleaseNamespace,
        '--wait', '--timeout', '5m'
    ) -Description $Description
}

function Ensure-KindNodesRunning {
    param([Parameter(Mandatory)][string]$Name)

    $nodes = & kind get nodes --name $Name
    if ($LASTEXITCODE -ne 0) {
        throw "Could not list nodes for Kind cluster '$Name'."
    }

    foreach ($node in $nodes) {
        $running = & docker inspect --format '{{.State.Running}}' $node
        if ($LASTEXITCODE -ne 0) {
            throw "Could not inspect Kind node '$node'."
        }

        if (($running -join '').Trim() -ne 'true') {
            Write-Host "Starting Kind node: $node" -ForegroundColor Yellow
            Invoke-Checked -FilePath 'docker' -Arguments @('start', $node) `
                -Description "Starting Kind node '$node'"
        }
    }
}

function Remove-KindAdminContext {
    param(
        [Parameter(Mandatory)][string]$BootstrapContextName,
        [Parameter(Mandatory)][string]$AdminContextName,
        [Parameter(Mandatory)][string]$ClusterName
    )

    $contexts = & kubectl config get-contexts -o name
    if ($LASTEXITCODE -ne 0) {
        throw 'Could not inspect kubeconfig contexts.'
    }

    $currentContext = & kubectl config current-context 2>$null
    if ($LASTEXITCODE -eq 0 -and ($currentContext -join '').Trim() -eq $AdminContextName) {
        if ($contexts -contains $BootstrapContextName) {
            Invoke-Checked -FilePath 'kubectl' -Arguments @('config', 'use-context', $BootstrapContextName) `
                -Description "Switching the current context back to '$BootstrapContextName'"
        }
    }

    if ($contexts -contains $AdminContextName) {
        Invoke-Checked -FilePath 'kubectl' -Arguments @('config', 'delete-context', $AdminContextName) `
            -Description "Removing generated kubeconfig context '$AdminContextName'"
    }

    $adminUserName = "k8s-admin-$ClusterName"
    $configJson = & kubectl config view -o json
    if ($LASTEXITCODE -ne 0) {
        throw 'Could not inspect kubeconfig users.'
    }
    $config = ($configJson -join "`n") | ConvertFrom-Json
    if (@($config.users | Where-Object { $_.name -eq $adminUserName }).Count -gt 0) {
        Invoke-Checked -FilePath 'kubectl' -Arguments @('config', 'delete-user', $adminUserName) `
            -Description "Removing generated kubeconfig user '$adminUserName'"
    }
}

try {
    Write-Step 'Loading infrastructure configuration'
    $InfraEnvFile = Join-Path $InfraDir '.env'
    $InfraSecretsFile = Join-Path $InfraDir '.env.secrets'
    $ComposeFile = Join-Path $InfraDir 'docker-compose.yml'
    $NamespaceManifest = Join-Path $K8sDir 'bootstrap\namespace.yaml'

    $script:Settings = Read-DotEnvFile -Path $InfraEnvFile
    $infraSecrets = Read-DotEnvFile -Path $InfraSecretsFile
    foreach ($key in $infraSecrets.Keys) {
        # Keep the same precedence as up.ps1: .env.secrets overrides .env.
        $script:Settings[$key] = $infraSecrets[$key]
    }

    $ProjectName = Get-RequiredSetting -Name 'PROJECT_NAME'
    $InfrastructureMode = (Get-Setting -Name 'INFRASTRUCTURE_MODE' -Default 'compose').ToLowerInvariant()
    $K8sDistribution = (Get-Setting -Name 'K8S_DISTRIBUTION' -Default 'kind').ToLowerInvariant()

    if ($InfrastructureMode -notin @('compose', 'external')) {
        throw "INFRASTRUCTURE_MODE must be 'compose' or 'external'. Current value: '$InfrastructureMode'."
    }
    if ($K8sDistribution -notin @('kind', 'k3s')) {
        throw "K8S_DISTRIBUTION must be 'kind' or 'k3s'. Current value: '$K8sDistribution'."
    }

    Assert-File -Path $NamespaceManifest
    $namespaceText = Get-Content -LiteralPath $NamespaceManifest -Raw
    $namespaceMatch = [regex]::Match($namespaceText, '(?ms)^metadata:\s*\r?\n\s+name:\s*([^\s#]+)')
    if (-not $namespaceMatch.Success) {
        throw "Could not determine Namespace from '$NamespaceManifest'."
    }

    $Namespace = $namespaceMatch.Groups[1].Value.Trim([char[]]@('"', "'"))
    $configuredNamespace = Get-Setting -Name 'K8S_NAMESPACE' -Default $Namespace
    if ($configuredNamespace -ne $Namespace) {
        throw "K8S_NAMESPACE='$configuredNamespace' does not match '$Namespace' in the static Namespace manifest."
    }

    $ClusterName = Get-Setting -Name 'K8S_CLUSTER_NAME' -Default "$ProjectName-local"
    $BootstrapContext = "kind-$ClusterName"
    $ConfiguredContext = Get-Setting -Name 'K8S_CONTEXT' -Default ''

    if ($K8sDistribution -eq 'k3s') {
        if ([string]::IsNullOrWhiteSpace($ConfiguredContext)) {
            throw 'K8S_CONTEXT is required when K8S_DISTRIBUTION=k3s.'
        }
        $KubeContext = $ConfiguredContext
    }
    else {
        if ($ConfiguredContext -and $ConfiguredContext -ne $BootstrapContext) {
            throw "K8S_CONTEXT='$ConfiguredContext' does not match Kind context '$BootstrapContext'."
        }
        # Use the Kind bootstrap context: the short-lived k8s-admin token
        # generated by up.ps1 may already have expired.
        $KubeContext = $BootstrapContext
    }

    $ApplicationReleaseNames = @(Get-ApplicationReleaseNames `
        -Registry (Get-RequiredSetting -Name 'APPLICATIONS'))

    $GatewayName = Get-Setting -Name 'GATEWAY_NAME' -Default 'gateway'
    $RbacNamespace = Get-Setting -Name 'RBAC_NAMESPACE' -Default 'k8s-access'
    $NgfReleaseName = Get-Setting -Name 'NGF_RELEASE_NAME' -Default 'ngf'
    $NgfNamespace = Get-Setting -Name 'NGF_NAMESPACE' -Default 'nginx-gateway'

    if ($Namespace -in @($RbacNamespace, $NgfNamespace)) {
        throw 'K8S_NAMESPACE must be different from RBAC_NAMESPACE and NGF_NAMESPACE; refusing to delete a shared namespace.'
    }

    # These are shared cluster-level components in a multi-project k3s cluster.
    # Keep them by default on k3s; local Kind is treated as project-dedicated.
    $RemoveClusterComponents = Get-BooleanSetting `
        -Name 'REMOVE_CLUSTER_COMPONENTS' `
        -Default ($K8sDistribution -eq 'kind')

    # A Kind cluster is deleted only when explicitly requested. This setting
    # is intentionally rejected for k3s to protect the externally managed cluster.
    $DeleteKindCluster = Get-BooleanSetting -Name 'K8S_DELETE_CLUSTER' -Default $false
    if ($DeleteKindCluster -and $K8sDistribution -ne 'kind') {
        throw 'K8S_DELETE_CLUSTER=true is only supported for Kind. A k3s cluster is externally managed.'
    }

    Write-Host "Project:                   $ProjectName" -ForegroundColor Gray
    Write-Host "Infrastructure mode:       $InfrastructureMode" -ForegroundColor Gray
    Write-Host "Kubernetes distribution:   $K8sDistribution" -ForegroundColor Gray
    Write-Host "Kubernetes context:        $KubeContext" -ForegroundColor Gray
    Write-Host "Application namespace:     $Namespace" -ForegroundColor Gray
    Write-Host "Remove NGF/RBAC releases:  $RemoveClusterComponents" -ForegroundColor Gray
    if ($K8sDistribution -eq 'kind') {
        Write-Host "Delete Kind cluster:       $DeleteKindCluster" -ForegroundColor Gray
    }

    Write-Step 'Checking required tools'
    $requiredTools = @('kubectl', 'helm')
    if ($K8sDistribution -eq 'kind') { $requiredTools += 'kind', 'docker' }
    if ($InfrastructureMode -eq 'compose') { $requiredTools += 'docker' }
    foreach ($tool in ($requiredTools | Select-Object -Unique)) {
        if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
            throw "Required command '$tool' was not found in PATH."
        }
    }

    $KubernetesAvailable = $true
    if ($K8sDistribution -eq 'kind') {
        $clusters = & kind get clusters
        if ($LASTEXITCODE -ne 0) {
            throw 'Could not list Kind clusters.'
        }
        $KubernetesAvailable = @($clusters | Where-Object { $_.Trim() -eq $ClusterName }).Count -gt 0

        if (-not $KubernetesAvailable) {
            Write-Host "Kind cluster '$ClusterName' does not exist; Kubernetes cleanup will be skipped." -ForegroundColor Yellow
        }
        else {
            Ensure-KindNodesRunning -Name $ClusterName
            Invoke-Checked -FilePath 'kind' -Arguments @('export', 'kubeconfig', '--name', $ClusterName) `
                -Description 'Refreshing the Kind bootstrap kubeconfig context'
        }
    }
    else {
        $contexts = & kubectl config get-contexts -o name
        if ($LASTEXITCODE -ne 0 -or $contexts -notcontains $KubeContext) {
            throw "Kubeconfig context '$KubeContext' was not found."
        }
    }

    if ($KubernetesAvailable) {
        Write-Step 'Removing the project Gateway release'
        Remove-HelmRelease -ReleaseName $GatewayName -ReleaseNamespace $Namespace `
            -ContextName $KubeContext -Description "Uninstalling Gateway release '$GatewayName'"

        Write-Step 'Removing application Helm releases'
        for ($index = $ApplicationReleaseNames.Count - 1; $index -ge 0; $index--) {
            $releaseName = $ApplicationReleaseNames[$index]
            Remove-HelmRelease -ReleaseName $releaseName -ReleaseNamespace $Namespace `
                -ContextName $KubeContext -Description "Uninstalling application release '$releaseName'"
        }

        if ($RemoveClusterComponents) {
            Write-Step 'Removing NGINX Gateway Fabric'
            Remove-HelmRelease -ReleaseName $NgfReleaseName -ReleaseNamespace $NgfNamespace `
                -ContextName $KubeContext -Description "Uninstalling NGINX Gateway Fabric release '$NgfReleaseName'"
        }
        else {
            Write-Host 'Keeping the NGINX Gateway Fabric controller and its namespace.' -ForegroundColor Gray
        }

        Write-Step 'Removing the application namespace'
        Invoke-Checked -FilePath 'kubectl' -Arguments @(
            '--context', $KubeContext, 'delete', 'namespace', $Namespace,
            '--ignore-not-found=true', '--wait=true', '--timeout=5m'
        ) -Description "Deleting application namespace '$Namespace'"

        if ($RemoveClusterComponents) {
            Write-Step 'Removing project RBAC'
            Remove-HelmRelease -ReleaseName 'rbac' -ReleaseNamespace $RbacNamespace `
                -ContextName $KubeContext -Description 'Uninstalling RBAC release'
        }
        else {
            Write-Host 'Keeping the RBAC release and its namespace.' -ForegroundColor Gray
        }

        # Gateway API CRDs are intentionally retained: they are cluster-wide
        # APIs and may be used by other Gateway implementations or namespaces.
    }

    if ($K8sDistribution -eq 'kind') {
        Remove-KindAdminContext -BootstrapContextName $BootstrapContext `
            -AdminContextName "k8s-admin@$ClusterName" -ClusterName $ClusterName

        if ($DeleteKindCluster -and $KubernetesAvailable) {
            Write-Step "Deleting Kind cluster '$ClusterName'"
            Invoke-Checked -FilePath 'kind' -Arguments @('delete', 'cluster', '--name', $ClusterName) `
                -Description "Deleting Kind cluster '$ClusterName'"
        }
    }

    if ($InfrastructureMode -eq 'compose') {
        Assert-File -Path $ComposeFile
        Write-Step 'Stopping local infrastructure through Docker Compose'
        Invoke-Checked -FilePath 'docker' -Arguments @(
            'compose',
            '--env-file', $InfraEnvFile,
            '--env-file', $InfraSecretsFile,
            '--project-directory', $InfraDir,
            '-f', $ComposeFile,
            'down'
        ) -Description 'Stopping local infrastructure services'
        Write-Host 'Docker volumes and images were preserved.' -ForegroundColor Gray
    }
    else {
        Write-Host 'Infrastructure mode is external; Docker Compose was not touched.' -ForegroundColor Gray
    }

    Write-Step 'Environment is down'
}
catch {
    Write-Host "`nDOWN FAILED: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
