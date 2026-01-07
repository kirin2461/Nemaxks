//! Shared types and utilities for microservices

use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

/// Common error response structure
#[derive(Debug, Serialize, Deserialize)]
pub struct ErrorResponse {
    pub error: String,
    pub message: String,
}

/// Common success response
#[derive(Debug, Serialize, Deserialize)]
pub struct SuccessResponse<T: Serialize> {
    pub success: bool,
    pub data: T,
}
