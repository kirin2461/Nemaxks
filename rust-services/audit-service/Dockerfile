FROM rust:1.75-slim as builder

WORKDIR /usr/src/app
COPY rust-services/audit-service ./audit-service
COPY proto ./proto
COPY rust-services/Cargo.toml ./

RUN cargo build --release -p audit-service

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y libssl3 ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /usr/src/app/target/release/audit-service /usr/local/bin/

EXPOSE 50051
CMD ["audit-service"]
