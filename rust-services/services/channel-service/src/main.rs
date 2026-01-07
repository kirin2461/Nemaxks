use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use serde_json::json;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

#[derive(Clone)]
struct AppState {
    _dummy: Arc<RwLock<String>>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();
    env_logger::init();

    let port = std::env::var("SERVICE_PORT")
        .unwrap_or_else(|_| "8002".to_string());

    let state = AppState {
        _dummy: Arc::new(RwLock::new("channel-service".to_string())),
    };

    let app = Router::new()
        .route("/health", get(health_check))
        .route("/api/channels", post(create_channel))
        .route("/api/channels/:id", get(get_channel))
        .route("/api/channels/:id/subscribe", post(subscribe_channel))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port)).await?;
    tracing::info!("Channel Service listening on port {}", port);

    axum::serve(listener, app).await?;
    Ok(())
}

async fn health_check() -> Json<serde_json::Value> {
    Json(json!({
        "status": "healthy",
        "service": "channel-service"
    }))
}

async fn create_channel(
    Json(payload): Json<serde_json::Value>,
) -> (StatusCode, Json<serde_json::Value>) {
    let channel_id = Uuid::new_v4();
    (StatusCode::CREATED, Json(json!({
        "id": channel_id,
        "name": payload.get("name"),
        "created_at": chrono::Utc::now()
    })))
}

async fn get_channel(
    Path(id): Path<String>,
) -> Json<serde_json::Value> {
    Json(json!({
        "id": id,
        "name": "General",
        "members": 0
    }))
}

async fn subscribe_channel(
    Path(id): Path<String>,
) -> Json<serde_json::Value> {
    Json(json!({
        "success": true,
        "channel_id": id,
        "message": "Subscribed successfully"
    }))
}
