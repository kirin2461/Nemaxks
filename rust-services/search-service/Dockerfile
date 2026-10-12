# Build context = КОРЕНЬ репозитория (нужны proto/ и rust-services/Cargo.toml)
FROM rust:1.89-slim AS builder

# protoc нужен tonic-build (build.rs), gcc — для bundled-сборки zstd
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    protobuf-compiler \
    pkg-config \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app
COPY rust-services/search-service ./search-service
COPY proto ./proto
COPY rust-services/Cargo.toml rust-services/Cargo.lock ./

RUN cargo build --release -p search-service

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends libssl3 ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /usr/src/app/target/release/search-service /usr/local/bin/

EXPOSE 50052
CMD ["search-service"]
