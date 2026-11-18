# Atalhos de desenvolvimento. Requer JDK 17 e Android SDK (compileSdk 35).

SHELL := /bin/bash
MOBILE := mobile

.DEFAULT_GOAL := help

.PHONY: help guardrails deps audit test build apk check clean

help: ## Lista os alvos disponíveis
	@grep -hE '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

guardrails: ## Gate de privacidade, higiene do repositório e segredos (sem Android SDK)
	@bash scripts/privacy-check.sh
	@bash scripts/repo-hygiene-check.sh
	@bash scripts/secret-scan.sh

deps: ## Instala as dependências Node usadas na auditoria de supply chain
	@cd $(MOBILE) && npm ci

audit: ## Testa a política de auditoria e verifica vulnerabilidades npm
	@node --test scripts/dependency-audit.test.mjs
	@node scripts/dependency-audit.mjs

test: ## Executa os testes unitários Android
	@cd $(MOBILE) && ./gradlew test

build: ## Gera o APK de debug
	@cd $(MOBILE) && ./gradlew assembleDebug

apk: ## Gera o APK de release (exige keystore e credenciais no ambiente)
	@cd $(MOBILE) && ./gradlew assembleRelease

check: guardrails audit test ## Pipeline completo local

clean: ## Limpa artefatos de build
	@cd $(MOBILE) && ./gradlew clean
