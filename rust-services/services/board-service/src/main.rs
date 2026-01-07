use axum::{
    routing::get,
    Json, Router,
};
use serde_json::json;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();
    env_logger::init();

    let port = std::env::var("SERVICE_PORT")
        .unwrap_or_else(|_| "8004".to_string());

    let app = Router::new()
        .route("/health", get(health_check))
        .route("/api/status", get(service_status));

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port)).await?;
    tracing::info!("board-service listening on port {}", port);

    axum::serve(listener, app).await?;
    Ok(())
}

async fn health_check() -> Json<serde_json::Value> {
    Json(json!({
        "status": "healthy",
        "service": "board-service"
    }))
}

async fn service_status() -> Json<serde_json::Value> {
    Json(json!({
        "service": "board-service",
        "uptime": "active",
        "timestamp": chrono::Utc::now()
    }))
}
