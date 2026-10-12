# Makefile for Nemaxks
#
# NOTE: proto-* target'ы — EXPERIMENTAL. gRPC-транспорт не активен
# (см. README.md, раздел "gRPC (experimental)"). backend/proto/*.pb.go —
# рукописные заглушки; регенерация требует third_party/googleapis.

.PHONY: proto proto-clean proto-install build test docker-up docker-down help

# ===========================================
# Основные target'ы
# ===========================================

# Сборка backend (Go) и frontend (Vite)
build:
	@echo "Building backend..."
	cd backend && go build ./...
	@echo "Building frontend..."
	cd frontend && npm ci && npm run build
	@echo "✓ Build complete"

# Тесты backend + проверки
test:
	@echo "Running Go tests..."
	cd backend && go vet ./... && go test ./...
	@echo "✓ Tests complete"

# Поднять стек (postgres, redis, livekit, backend, frontend-prod)
docker-up:
	docker compose up -d --build

# Остановить стек
docker-down:
	docker compose down

# ===========================================
# Proto (EXPERIMENTAL, gRPC не подключён)
# ===========================================

# Proto generation
proto:
	@echo "Generating protobuf files..."
	@mkdir -p backend/proto/voice backend/proto/auth backend/proto/channels
	protoc --go_out=. --go_opt=paths=source_relative \
		--go-grpc_out=. --go-grpc_opt=paths=source_relative \
		--grpc-gateway_out=. --grpc-gateway_opt=paths=source_relative \
		--grpc-gateway_opt=logtostderr=true \
		-I proto \
		-I third_party/googleapis \
		proto/*.proto
	@echo "✓ Proto files generated"

# Install protoc dependencies
proto-install:
	@echo "Installing protoc plugins..."
	go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
	go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
	go install github.com/grpc-ecosystem/grpc-gateway/v2/protoc-gen-grpc-gateway@latest
	go install github.com/grpc-ecosystem/grpc-gateway/v2/protoc-gen-openapiv2@latest
	@echo "✓ Installing googleapis..."
	@mkdir -p third_party
	@if [ ! -d "third_party/googleapis" ]; then \
		git clone https://github.com/googleapis/googleapis.git third_party/googleapis; \
	fi
	@echo "✓ Protoc plugins installed"

# Clean generated files
proto-clean:
	@echo "Cleaning generated proto files..."
	rm -rf backend/proto
	@echo "✓ Cleaned"

# Help
help:
	@echo "Available targets:"
	@echo "  build         - Build backend (Go) and frontend (Vite)"
	@echo "  test          - Run go vet + go test (backend)"
	@echo "  docker-up     - docker compose up -d --build (full stack)"
	@echo "  docker-down   - docker compose down"
	@echo "  proto-install - [EXPERIMENTAL] Install protoc plugins and googleapis"
	@echo "  proto         - [EXPERIMENTAL] Generate Go code from proto files"
	@echo "  proto-clean   - [EXPERIMENTAL] Clean generated proto files"
