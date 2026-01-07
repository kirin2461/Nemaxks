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
use tracing_subscriber;

mod message_service;
use message_service::MessageService;

#[derive(Clone)]
struct AppState {
    service: Arc<RwLock<MessageService>>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize logging
    tracing_subscriber::fmt::init();
    env_logger::init();

    let db_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgresql://comm_user:comm_password@localhost:5432/communication_db".to_string());
    let redis_url = std::env::var("REDIS_URL")
        .unwrap_or_else(|_| "redis://localhost:6379".to_string());
    let port = std::env::var("SERVICE_PORT")
        .unwrap_or_else(|_| "8001".to_string());

    // Initialize service
    tracing::info!("Initializing Message Service...");
    let service = MessageService::new(&db_url, &redis_url).await?;
    let state = AppState {
        service: Arc::new(RwLock::new(service)),
    };

    // Build router
    let app = Router::new()
        .route("/health", get(health_check))
        .route("/api/messages", post(create_message))
        .route("/api/messages/:id", get(get_message))
        .route("/api/channels/:channel_id/messages", get(list_messages))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port)).await?;
    tracing::info!("Message Service listening on port {}", port);

    axum::serve(listener, app).await?;

    Ok(())
}

async fn health_check() -> Json<serde_json::Value> {
    Json(json!({
        "status": "healthy",
        "service": "message-service",
        "timestamp": chrono::Utc::now()
    }))
}

async fn create_message(
    State(_state): State<AppState>,
    Json(payload): Json<serde_json::Value>,
) -> (StatusCode, Json<serde_json::Value>) {
    tracing::info!("Creating message: {:?}", payload);
    let message_id = Uuid::new_v4();
    
    (StatusCode::CREATED, Json(json!({
        "success": true,
        "message_id": message_id,
        "timestamp": chrono::Utc::now()
    })))
}

async fn get_message(
    State(_state): State<AppState>,
    Path(id): Path<String>,
) -> Json<serde_json::Value> {
    tracing::info!("Fetching message: {}", id);
    
    Json(json!({
        "id": id,
        "content": "Sample message",
        "timestamp": chrono::Utc::now()
    }))
}

async fn list_messages(
    State(_state): State<AppState>,
    Path(channel_id): Path<String>,
) -> Json<serde_json::Value> {
    tracing::info!("Listing messages for channel: {}", channel_id);
    
    Json(json!({
        "channel_id": channel_id,
        "messages": [],
        "total": 0
    }))
}

mod message_service {
    use tokio_postgres::NoTls;
    use redis::aio::ConnectionManager;
    use anyhow::Result;

    pub struct MessageService {
        pub db_client: Option<tokio_postgres::Client>,
        pub redis_client: Option<ConnectionManager>,
    }

    impl MessageService {
        pub async fn new(db_url: &str, redis_url: &str) -> Result<Self> {
            tracing::debug!("Connecting to database: {}", db_url);
            let (client, connection) = tokio_postgres::connect(db_url, NoTls).await
                .map_err(|e| {
                    tracing::warn!("Database connection failed: {}", e);
                    anyhow::anyhow!(e)
                })?;
            
            tokio::spawn(async move {
                if let Err(e) = connection.await {
                    tracing::error!("Connection error: {}", e);
                }
            });

            let redis_client = redis::Client::open(redis_url)
                .and_then(|c| std::future::ready(Ok(c)))
                .ok()
                .and_then(|c| {
                    std::future::block_on(async {
                        c.get_connection_manager().await.ok()
                    })
                });

            tracing::info!("Message Service initialized successfully");

            Ok(MessageService {
                db_client: Some(client),
                redis_client,
            })
        }
    }
}
