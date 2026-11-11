{{/*
Return the chart component name used in standard Kubernetes labels.
*/}}
{{- define "backend.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Use the Helm release name as the resource name by default. The release name is
also the in-cluster Service DNS name expected by the current application setup.
*/}}
{{- define "backend.fullname" -}}
{{- default .Release.Name .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/* Labels used by Deployment selectors and pod templates. */}}
{{- define "backend.selectorLabels" -}}
app.kubernetes.io/name: {{ .Release.Name }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/* Common metadata labels. Project-specific part-of is optional. */}}
{{- define "backend.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | quote }}
{{ include "backend.selectorLabels" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{ with .Values.partOf }}
app.kubernetes.io/part-of: {{ . | quote }}
{{ end }}
{{- end -}}
