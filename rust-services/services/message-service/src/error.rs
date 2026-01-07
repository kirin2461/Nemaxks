use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ServiceError {
    #[error("Database error: {0}")]
    DatabaseError(String),
    
    #[error("Redis error: {0}")]
    CacheError(String),
    
    #[error("Not found")]
    NotFound,
    
    #[error("Invalid request: {0}")]
    InvalidRequest(String),
    
    #[error("Internal server error")]
    InternalError,
}

impl IntoResponse for ServiceError {
    fn into_response(self) -> Response {
        let (status, error_message) = match self {
            ServiceError::DatabaseError(msg) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                msg,
            ),
            ServiceError::CacheError(msg) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                msg,
            ),
            ServiceError::NotFound => (
                StatusCode::NOT_FOUND,
                "Resource not found".to_string(),
            ),
            ServiceError::InvalidRequest(msg) => (
                StatusCode::BAD_REQUEST,
                msg,
            ),
            ServiceError::InternalError => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Internal server error".to_string(),
            ),
        };

        let body = Json(json!({
            "error": error_message,
            "status": status.as_u16(),
        }));

        (status, body).into_response()
    }
}
