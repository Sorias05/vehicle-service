{{/* Chart component name used in standard Kubernetes labels. */}}
{{- define "gateway.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/* Default resource base name. */}}
{{- define "gateway.fullname" -}}
{{- default .Release.Name .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/* Actual Gateway resource name; overridable independently of the release. */}}
{{- define "gateway.gatewayName" -}}
{{- default (include "gateway.fullname" .) .Values.gateway.name | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/* NginxProxy must be in the same namespace as its Gateway. */}}
{{- define "gateway.nginxProxyName" -}}
{{- $defaultName := printf "%s-proxy" (include "gateway.gatewayName" . | trunc 57 | trimSuffix "-") -}}
{{- default $defaultName .Values.nginxProxy.name | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/* Common labels. */}}
{{- define "gateway.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | quote }}
app.kubernetes.io/name: {{ include "gateway.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{ with .Values.partOf }}
app.kubernetes.io/part-of: {{ . | quote }}
{{ end }}
{{- end -}}
