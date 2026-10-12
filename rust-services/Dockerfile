# Сборка всего rust-workspace (audit-service + search-service).
# ВАЖНО: build context = КОРЕНЬ репозитория (нужен ../proto):
#   docker build -f rust-services/Dockerfile -t nemaxks-rust-services .
#
# rust:1.92 не существует — используем стабильную серию 1.8x (1.89: edition2024 + свежие time/uuid).
FROM rust:1.89-slim AS builder

WORKDIR /build

# protoc нужен tonic-build (build.rs), gcc — для bundled-сборки zstd
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    protobuf-compiler \
    pkg-config \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY rust-services/Cargo.toml rust-services/Cargo.lock ./
COPY proto ./proto
COPY rust-services/audit-service ./audit-service
COPY rust-services/search-service ./search-service

RUN cargo build --release

# Runtime stage
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /build/target/release/audit-service /app/
COPY --from=builder /build/target/release/search-service /app/

EXPOSE 50051 50052

# По умолчанию запускаем audit-service; search-service:
#   docker run ... <image> ./search-service
CMD ["./audit-service"]
