{{/*
Return the chart component name used in standard Kubernetes labels.
*/}}
{{- define "frontend.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Use the Helm release name as the resource name by default. The release name
is also the in-cluster Service DNS name expected by Gateway routes.
*/}}
{{- define "frontend.fullname" -}}
{{- default .Release.Name .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/* Labels used by Deployment selectors and pod templates. */}}
{{- define "frontend.selectorLabels" -}}
app.kubernetes.io/name: {{ include "frontend.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{/* Common metadata labels. Project-specific part-of is optional. */}}
{{- define "frontend.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | quote }}
{{ include "frontend.selectorLabels" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{ with .Values.partOf }}
app.kubernetes.io/part-of: {{ . | quote }}
{{ end }}
{{- end -}}
