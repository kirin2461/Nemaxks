use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde_json::json;
use uuid::Uuid;
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::models::{CreateMessageRequest, Message};
use crate::MessageService;
use crate::db;
use crate::cache;

pub type SharedState = Arc<RwLock<MessageService>>;

pub async fn create_message(
    State(state): State<SharedState>,
    Json(payload): Json<CreateMessageRequest>,
) -> (StatusCode, Json<serde_json::Value>) {
    let message = Message {
        id: Uuid::new_v4(),
        channel_id: payload.channel_id,
        user_id: payload.user_id,
        content: payload.content.clone(),
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    };

    let state_guard = state.read().await;
    
    if let Err(e) = db::save_message(&state_guard.db_client, &message).await {
        tracing::error!("Failed to save message: {}", e);
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({
            "success": false,
            "error": "Failed to save message"
        })));
    }

    if let Err(e) = cache::cache_message(&state_guard.redis_client, &message.id.to_string(), &serde_json::to_string(&message).unwrap_or_default()).await {
        tracing::warn!("Failed to cache message: {}", e);
    }

    tracing::info!("Message created: {}", message.id);

    (StatusCode::CREATED, Json(json!({
        "success": true,
        "message": message
    })))
}

pub async fn get_messages(
    State(state): State<SharedState>,
    Path(channel_id): Path<Uuid>,
) -> Json<serde_json::Value> {
    let state_guard = state.read().await;

    match db::get_messages_by_channel(&state_guard.db_client, &channel_id).await {
        Ok(messages) => Json(json!({
            "success": true,
            "channel_id": channel_id,
            "messages": messages,
            "total": messages.len()
        })),
        Err(e) => {
            tracing::error!("Failed to fetch messages: {}", e);
            Json(json!({
                "success": false,
                "error": "Failed to fetch messages",
                "messages": []
            }))
        }
    }
}

pub async fn get_message_by_id(
    State(state): State<SharedState>,
    Path(id): Path<Uuid>,
) -> Json<serde_json::Value> {
    let state_guard = state.read().await;

    if let Ok(Some(cached)) = cache::get_cached(&state_guard.redis_client, &id.to_string()).await {
        if let Ok(message) = serde_json::from_str::<Message>(&cached) {
            return Json(json!({
                "success": true,
                "message": message,
                "cached": true
            }));
        }
    }

    match db::get_message(&state_guard.db_client, &id).await {
        Ok(Some(message)) => {
            if let Ok(json_str) = serde_json::to_string(&message) {
                let _ = cache::cache_message(&state_guard.redis_client, &id.to_string(), &json_str).await;
            }
            Json(json!({
                "success": true,
                "message": message,
                "cached": false
            }))
        }
        Ok(None) => Json(json!({
            "success": false,
            "error": "Message not found"
        })),
        Err(e) => {
            tracing::error!("Failed to fetch message: {}", e);
            Json(json!({
                "success": false,
                "error": "Failed to fetch message"
            }))
        }
    }
}
