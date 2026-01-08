# Build stage
FROM rust:1.92 as builder

WORKDIR /build

COPY Cargo.toml Cargo.lock ./
COPY shared ./shared
COPY services ./services

RUN cargo build --release

# Runtime stage
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    libpq5 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /build/target/release /app/

EXPOSE 8001 8002 8003 8004

CMD ["./message-service"]
