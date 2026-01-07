//! Message Service - Handles real-time message storage and retrieval
//! Uses async Tokio with PostgreSQL and Redis caching

pub mod models;
pub mod db;
pub mod cache;
pub mod handlers;

use tokio_postgres::NoTls;
use redis::aio::ConnectionManager;
use anyhow::Result;

pub struct MessageService {
    pub db_client: tokio_postgres::Client,
    pub redis_client: ConnectionManager,
}

impl MessageService {
    /// Initialize the message service with database and cache connections
    pub async fn new(db_url: &str, redis_url: &str) -> Result<Self> {
        let (client, connection) = tokio_postgres::connect(db_url, NoTls).await?;
        tokio::spawn(async move {
            if let Err(e) = connection.await {
                eprintln!("Connection error: {}", e);
            }
        });

        let redis_client = redis::Client::open(redis_url)?
            .get_connection_manager()
            .await?;

        Ok(MessageService {
            db_client: client,
            redis_client,
        })
    }
}
