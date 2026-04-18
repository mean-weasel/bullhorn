# Bullhorn - Makefile
# Run `make help` to see available commands

.PHONY: help install install-hooks dev dev-full build test test-e2e lint typecheck knip format check fix clean all qa-dev qa-seed qa-reset qa-seed-empty

# Default target
.DEFAULT_GOAL := help

# Colors for output
BLUE := \033[34m
GREEN := \033[32m
YELLOW := \033[33m
RED := \033[31m
RESET := \033[0m

# Get local IP for network access
LOCAL_IP = $(shell /sbin/ifconfig en0 2>/dev/null | grep "inet " | awk '{print $$2}' || /sbin/ifconfig en1 2>/dev/null | grep "inet " | awk '{print $$2}' || hostname -I 2>/dev/null | awk '{print $$1}' || echo "localhost")

help: ## Show this help message
	@echo "$(BLUE)Bullhorn$(RESET) - Available commands:"
	@echo ""
	@echo "$(YELLOW)Development (Next.js + Supabase)$(RESET)"
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | grep -E '(dev|supabase|db-)' | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-20s$(RESET) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(YELLOW)Build & Deploy$(RESET)"
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | grep -E '(build|deploy|preview)' | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-20s$(RESET) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(YELLOW)Testing$(RESET)"
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | grep -E 'test' | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-20s$(RESET) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(YELLOW)QA Testing$(RESET)"
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | grep -E 'qa-' | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-20s$(RESET) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(YELLOW)Code Quality$(RESET)"
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | grep -E '(lint|type|format|check|knip)' | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-20s$(RESET) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(YELLOW)Utilities$(RESET)"
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | grep -E '(clean|install|setup|mcp|ip|logs)' | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-20s$(RESET) %s\n", $$1, $$2}'
	@echo ""

# =============================================================================
# Setup
# =============================================================================

install: ## Install all dependencies
	@echo "$(BLUE)Installing dependencies...$(RESET)"
	npm ci
	@echo "$(BLUE)Installing MCP server dependencies...$(RESET)"
	cd mcp-server && npm ci
	@echo "$(BLUE)Installing Playwright browsers...$(RESET)"
	npx playwright install chromium
	@echo ""
	@echo "$(GREEN)✓ Dependencies installed! Run 'make setup' for first-time setup.$(RESET)"

install-hooks: ## Install git pre-commit hook (runs lint, typecheck, tests)
	@cp .claude/hooks/pre-commit .git/hooks/pre-commit
	@chmod +x .git/hooks/pre-commit
	@echo "$(GREEN)✓ Pre-commit hook installed$(RESET)"

setup: install install-hooks ## First-time setup (install deps + hooks + start Supabase + reset DB)
	@echo "$(BLUE)Starting local Supabase...$(RESET)"
	supabase start
	@echo "$(BLUE)Resetting database with migrations...$(RESET)"
	supabase db reset
	@echo ""
	@echo "$(GREEN)✓ Setup complete!$(RESET)"
	@echo "$(YELLOW)Run 'make dev' to start developing.$(RESET)"

nuke: ## Remove all node_modules and reinstall
	rm -rf node_modules package-lock.json
	rm -rf mcp-server/node_modules mcp-server/package-lock.json
	npm install
	cd mcp-server && npm install

# =============================================================================
# Development (Next.js + Supabase)
# =============================================================================

# Default ports (override with PORT=xxxx make dev)
NEXT_PORT ?= 3000

dev: ## Start Next.js dev server (requires Supabase running)
	@echo ""
	@echo "$(GREEN)Starting Next.js dev server...$(RESET)"
	@echo "$(YELLOW)Requested port: $${PORT:-$(NEXT_PORT)} (will auto-increment if busy)$(RESET)"
	@echo "$(YELLOW)Supabase Studio: http://localhost:54323$(RESET)"
	@echo ""
	@PORT=$${PORT:-$(NEXT_PORT)} npm run dev

dev-full: ## Start Supabase + Next.js together
	@echo ""
	@echo "$(GREEN)Starting Supabase and Next.js...$(RESET)"
	@make -j2 supabase-start dev-next-only 2>/dev/null || (make supabase-start && make dev-next-only)

dev-next-only:
	@sleep 3
	@PORT=$${PORT:-$(NEXT_PORT)} npm run dev

# =============================================================================
# Supabase
# =============================================================================

supabase-start: ## Start local Supabase
	@echo "$(BLUE)Starting local Supabase...$(RESET)"
	@supabase start || echo "$(YELLOW)Supabase may already be running$(RESET)"

supabase-stop: ## Stop local Supabase
	@echo "$(BLUE)Stopping local Supabase...$(RESET)"
	supabase stop

supabase-status: ## Check local Supabase status
	supabase status

supabase-studio: ## Open Supabase Studio in browser
	@echo "$(GREEN)Opening Supabase Studio...$(RESET)"
	open http://localhost:54323

supabase-link-dev: ## Link to dev Supabase project
	@echo "$(BLUE)Link to your dev Supabase project:$(RESET)"
	@echo "Get your project ref from: https://supabase.com/dashboard"
	@read -p "Enter project ref: " ref && supabase link --project-ref $$ref

supabase-link-prod: ## Link to prod Supabase project
	@echo "$(BLUE)Link to your prod Supabase project:$(RESET)"
	@echo "Get your project ref from: https://supabase.com/dashboard"
	@read -p "Enter project ref: " ref && supabase link --project-ref $$ref

# =============================================================================
# Database
# =============================================================================

db-reset: ## Reset local database (runs all migrations)
	@echo "$(BLUE)Resetting local database...$(RESET)"
	supabase db reset

db-migrate: ## Run pending migrations locally
	supabase migration up

db-new: ## Create new migration (usage: make db-new name=create_users)
	@if [ -z "$(name)" ]; then \
		echo "$(RED)Error: Specify migration name with 'make db-new name=your_migration_name'$(RESET)"; \
		exit 1; \
	fi
	supabase migration new $(name)

db-push: ## Push migrations to remote Supabase (dev)
	@echo "$(BLUE)Pushing migrations to remote...$(RESET)"
	supabase db push

db-pull: ## Pull remote schema changes
	supabase db pull

db-diff: ## Show diff between local and remote
	supabase db diff

db-seed: ## Seed local database with test data
	@if [ -f supabase/seed.sql ]; then \
		psql postgresql://postgres:postgres@localhost:54322/postgres -f supabase/seed.sql; \
		echo "$(GREEN)✓ Database seeded$(RESET)"; \
	else \
		echo "$(YELLOW)No seed file found at supabase/seed.sql$(RESET)"; \
	fi

db-migrate-sqlite: ## Migrate data from SQLite to Supabase
	@echo "$(BLUE)Migrating SQLite data to Supabase...$(RESET)"
	@SUPABASE_URL=http://127.0.0.1:54321 \
		SUPABASE_SERVICE_ROLE_KEY=$$(supabase status --output json 2>/dev/null | grep -o '"service_role_key":"[^"]*"' | cut -d'"' -f4) \
		npx tsx scripts/migrate-sqlite-to-supabase.ts

# =============================================================================
# Build & Deploy
# =============================================================================

build: ## Build Next.js for production
	@echo "$(BLUE)Building Next.js app...$(RESET)"
	npm run build

preview: build ## Preview production build locally
	npm run start

deploy: ## Deploy to Vercel (production)
	@echo "$(BLUE)Deploying to Vercel (production)...$(RESET)"
	vercel --prod

deploy-preview: ## Deploy preview to Vercel
	@echo "$(BLUE)Deploying preview to Vercel...$(RESET)"
	vercel

# =============================================================================
# Code Quality
# =============================================================================

lint: ## Run ESLint
	npm run lint

lint-fix: ## Run ESLint with auto-fix
	npm run lint:fix

typecheck: ## Run TypeScript type checking
	npm run typecheck

knip: ## Check for dead code and unused dependencies
	npm run knip

format: ## Format code with Prettier
	npm run format

format-check: ## Check code formatting
	npm run format:check

check: lint typecheck ## Run all code quality checks
	@echo ""
	@echo "$(GREEN)✓ All checks passed!$(RESET)"

fix: lint-fix format ## Fix all auto-fixable issues

# =============================================================================
# Testing
# =============================================================================

test: ## Run unit tests in watch mode
	npm run test

test-run: ## Run unit tests once
	npx vitest run

test-e2e: ## Run end-to-end tests
	npm run test:e2e

test-e2e-ui: ## Run E2E tests with UI
	npm run test:e2e:ui

test-e2e-debug: ## Run E2E tests in debug mode
	npm run test:e2e:debug

test-coverage: ## Run tests with coverage report
	npx vitest run --coverage

test-all: test-run test-e2e ## Run all tests (unit + e2e)

# =============================================================================
# QA Testing
# =============================================================================

QA_PORT ?= 3000
QA_FIXTURE ?= qa/fixtures/default.yaml

qa-dev: ## Start dev server in test mode for QA
	@echo "$(BLUE)Starting QA dev server (test mode, port $(QA_PORT))...$(RESET)"
	@echo "$(YELLOW)Auth bypassed — using test user$(RESET)"
	@echo ""
	CI=true E2E_TEST_MODE=true NEXT_PUBLIC_E2E_TEST_MODE=true PORT=$(QA_PORT) npm run dev

qa-seed: ## Reset database and seed QA fixtures
	@echo "$(BLUE)Seeding QA data from $(QA_FIXTURE)...$(RESET)"
	CI=true E2E_TEST_MODE=true npx tsx qa/seed.ts $(QA_FIXTURE) --port $(QA_PORT)

qa-reset: ## Reset QA database (no seeding)
	@echo "$(BLUE)Resetting QA database...$(RESET)"
	CI=true E2E_TEST_MODE=true npx tsx qa/seed.ts --reset-only --port $(QA_PORT)

qa-seed-empty: ## Reset to empty state (for empty-state workflows)
	@echo "$(BLUE)Resetting to empty state...$(RESET)"
	CI=true E2E_TEST_MODE=true npx tsx qa/seed.ts qa/fixtures/empty.yaml --port $(QA_PORT)

# =============================================================================
# MCP Server
# =============================================================================

mcp-dev: ## Run MCP server with local Supabase
	@echo "$(GREEN)Starting MCP server (local Supabase)...$(RESET)"
	cd mcp-server && \
		SUPABASE_URL=http://127.0.0.1:54321 \
		SUPABASE_SERVICE_ROLE_KEY=$$(supabase status --output json 2>/dev/null | grep -o '"service_role_key":"[^"]*"' | cut -d'"' -f4) \
		npm run dev

mcp-build: ## Build MCP server
	cd mcp-server && npm run build

# =============================================================================
# Utilities
# =============================================================================

clean: ## Clean build artifacts and cache
	rm -rf .next dist coverage playwright-report test-results
	@echo "$(GREEN)✓ Cleaned build artifacts$(RESET)"

logs: ## Show data locations
	@echo "$(BLUE)Data Locations:$(RESET)"
	@echo "  Local Supabase DB: postgresql://postgres:postgres@localhost:54322/postgres"
	@echo "  Supabase Studio:   http://localhost:54323"

ip: ## Show local network IP for mobile access
	@echo "$(GREEN)Your local IP: $(LOCAL_IP)$(RESET)"
	@echo ""
	@echo "Mobile access URLs (after running 'make dev'):"
	@echo "  App: http://$(LOCAL_IP):$${PORT:-$(NEXT_PORT)}"
	@echo ""
	@echo "$(YELLOW)Note: Check terminal for actual port if default is busy$(RESET)"

# =============================================================================
# Full Workflows
# =============================================================================

all: install check build ## Install, run checks, and build
	@echo ""
	@echo "$(GREEN)✓ Ready! Run 'make dev' to start development.$(RESET)"

ci: check test-run ## Run CI checks locally
	@echo ""
	@echo "$(GREEN)✓ CI checks passed!$(RESET)"

# Quick aliases
.PHONY: start stop studio
start: dev ## Alias for 'make dev'
stop: supabase-stop ## Alias for 'make supabase-stop'
studio: supabase-studio ## Alias for 'make supabase-studio'

# =============================================================================
# Self-Hosted
# =============================================================================

.PHONY: self-host-init self-host-up self-host-down self-host-status self-host-logs self-host-dev

## Start self-hosted Supabase (Docker)
self-host-up:
	cd self-hosted && docker compose up -d
	@echo "Supabase running at http://localhost:8000"
	@echo "Studio at http://localhost:3001 (if enabled)"

## Stop self-hosted Supabase
self-host-down:
	cd self-hosted && docker compose down

## Show self-hosted Supabase status
self-host-status:
	cd self-hosted && docker compose ps

## Show self-hosted Supabase logs
self-host-logs:
	cd self-hosted && docker compose logs -f --tail=50

## Initialize self-hosted setup (first time)
self-host-init:
	@bash self-hosted/setup.sh
	@test -f .env.local || (cp .env.self-hosted.example .env.local && echo "Created .env.local — edit with your platform keys")
	@echo ""
	@echo "Next steps:"
	@echo "  1. Edit self-hosted/.env with generated secrets"
	@echo "  2. Edit .env.local with your platform API keys"
	@echo "  3. Run: make self-host-up"
	@echo "  4. Run: make db-push  (apply migrations)"
	@echo "  5. Run: make self-host-dev"

## Start self-hosted dev server (Supabase Docker + Next.js)
self-host-dev: self-host-up
	@sleep 3
	$(MAKE) dev
