# Makefile for protobuf generation

.PHONY: proto proto-clean proto-install

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
	@echo "  proto-install - Install protoc plugins and googleapis"
	@echo "  proto         - Generate Go code from proto files"
	@echo "  proto-clean   - Clean generated proto files"
