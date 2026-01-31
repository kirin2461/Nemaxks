use tonic::{transport::Server, Request, Response, Status};
use tonic_health::server::health_reporter;
use sqlx::postgres::PgPoolOptions;
use dotenv::dotenv;
use std::env;
use chrono::Utc;
use tracing::{info, warn, error};
use tracing_subscriber;

pub mod audit {
    tonic::include_proto!("audit");
}
use audit::audit_service_server::{AuditService, AuditServiceServer};
use audit::{LogEventRequest, LogEventResponse, GetLogsRequest, GetLogsResponse, 
            BatchLogEventsRequest, BatchLogEventsResponse, AuditLogEntry};

#[derive(Debug, Clone)]
pub struct MyAuditService {
    pool: sqlx::PgPool,
}

#[tonic::async_trait]
impl AuditService for MyAuditService {
    async fn log_event(
        &self,
        request: Request<LogEventRequest>,
    ) -> Result<Response<LogEventResponse>, Status> {
        let req = request.into_inner();
        
        let result = sqlx::query(
            r#"INSERT INTO extended_audit_logs 
               (user_id, action, target_type, target_id, scope, details, ip_address, user_agent, created_at) 
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) 
               RETURNING id"#,
        )
        .bind(req.user_id as i64)
        .bind(&req.action)
        .bind(&req.target_type)
        .bind(&req.target_id)
        .bind(&req.scope)
        .bind(&req.details)
        .bind(&req.ip_address)
        .bind(&req.user_agent)
        .fetch_one(&self.pool)
        .await;

        match result {
            Ok(record) => {
                info!("[AuditService] Logged event with id={}", record.id);
                Ok(Response::new(LogEventResponse {
                    success: true,
                    id: record.id as u64,
                }))
            },
            Err(e) => {
                error!("[AuditService] Failed to log event: {}", e);
                Err(Status::internal(format!("Database error: {}", e)))
            }
        }
    }

    async fn get_logs(
        &self,
        request: Request<GetLogsRequest>,
    ) -> Result<Response<GetLogsResponse>, Status> {
        let req = request.into_inner();
        let page = req.page.max(1) as i64;
        let limit = req.limit.max(1).min(100) as i64;
        let offset = (page - 1) * limit;

        // Build parameterized query based on filters (SQL injection safe)
        let has_user_filter = req.user_id != 0;
        let has_action_filter = !req.action.is_empty();

        let (logs_result, count_result) = match (has_user_filter, has_action_filter) {
            (true, true) => {
                // Both filters
                let logs = sqlx::query(
                    r#"SELECT id, user_id, action, target_type, target_id, scope, details, ip_address, 
                              to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at
                       FROM extended_audit_logs 
                       WHERE user_id = $1 AND action = $2
                       ORDER BY created_at DESC LIMIT $3 OFFSET $4"#,
                )
                .bind(req.user_id as i64)
                .bind(&req.action)
                .bind(limit)
                .bind(offset)
                .fetch_all(&self.pool)
                .await;

                let count = sqlx::query("SELECT COUNT(*) as cnt FROM extended_audit_logs WHERE user_id = $1 AND action = $2")
                    .bind(req.user_id as i64)
                    .bind(&req.action)
                    .fetch_one(&self.pool)
                    .await;
                (logs, count)
            },
            (true, false) => {
                // Only user_id filter
                let logs = sqlx::query(
                    r#"SELECT id, user_id, action, target_type, target_id, scope, details, ip_address, 
                              to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at
                       FROM extended_audit_logs 
                       WHERE user_id = $1
                       ORDER BY created_at DESC LIMIT $2 OFFSET $3"#,
                )
                .bind(req.user_id as i64)
                .bind(limit)
                .bind(offset)
                .fetch_all(&self.pool)
                .await;

                let count = sqlx::query("SELECT COUNT(*) as cnt FROM extended_audit_logs WHERE user_id = $1")
                    .bind(req.user_id as i64)
                    .fetch_one(&self.pool)
                    .await;
                (logs, count)
            },
            (false, true) => {
                // Only action filter
                let logs = sqlx::query(
                    r#"SELECT id, user_id, action, target_type, target_id, scope, details, ip_address, 
                              to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at
                       FROM extended_audit_logs 
                       WHERE action = $1
                       ORDER BY created_at DESC LIMIT $2 OFFSET $3"#,
                )
                .bind(&req.action)
                .bind(limit)
                .bind(offset)
                .fetch_all(&self.pool)
                .await;

                let count = sqlx::query("SELECT COUNT(*) as cnt FROM extended_audit_logs WHERE action = $1")
                    .bind(&req.action)
                    .fetch_one(&self.pool)
                    .await;
                (logs, count)
            },
            (false, false) => {
                // No filters
                let logs = sqlx::query(
                    r#"SELECT id, user_id, action, target_type, target_id, scope, details, ip_address, 
                              to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at
                       FROM extended_audit_logs 
                       ORDER BY created_at DESC LIMIT $1 OFFSET $2"#,
                )
                .bind(limit)
                .bind(offset)
                .fetch_all(&self.pool)
                .await;

                let count = sqlx::query("SELECT COUNT(*) as cnt FROM extended_audit_logs")
                    .fetch_one(&self.pool)
                    .await;
                (logs, count)
            },
        };

        let logs_result = logs_result;
        let count_result = count_result;

        match (logs_result, count_result) {
            (Ok(logs), Ok(count_row)) => {
                use sqlx::Row;
                let audit_logs: Vec<AuditLogEntry> = logs.into_iter().map(|row| {
                    AuditLogEntry {
                        id: row.get::<i64, _>("id") as u64,
                        user_id: row.get::<i64, _>("user_id") as u64,
                        action: row.get("action"),
                        target_type: row.get("target_type"),
                        target_id: row.get("target_id"),
                        scope: row.get("scope"),
                        details: row.get("details"),
                        ip_address: row.get("ip_address"),
                        created_at: row.get::<Option<String>, _>("created_at").unwrap_or_default(),
                    }
                }).collect();

                Ok(Response::new(GetLogsResponse {
                    logs: audit_logs,
                    total: count_row.get::<Option<i64>, _>("cnt").unwrap_or(0),
                }))
            },
            _ => Err(Status::internal("Failed to fetch logs"))
        }
    }

    async fn batch_log_events(
        &self,
        request: Request<BatchLogEventsRequest>,
    ) -> Result<Response<BatchLogEventsResponse>, Status> {
        let req = request.into_inner();
        let mut tx = self.pool.begin().await
            .map_err(|e| Status::internal(format!("Transaction start failed: {}", e)))?;

        let mut count = 0;
        for event in req.events {
            let result = sqlx::query(
                r#"INSERT INTO extended_audit_logs 
                   (user_id, action, target_type, target_id, scope, details, ip_address, user_agent, created_at) 
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())"#,
            )
            .bind(event.user_id as i64)
            .bind(&event.action)
            .bind(&event.target_type)
            .bind(&event.target_id)
            .bind(&event.scope)
            .bind(&event.details)
            .bind(&event.ip_address)
            .bind(&event.user_agent)
            .execute(&mut *tx)
            .await;

            if result.is_ok() {
                count += 1;
            }
        }

        tx.commit().await
            .map_err(|e| Status::internal(format!("Transaction commit failed: {}", e)))?;

        info!("[AuditService] Batch logged {} events", count);
        Ok(Response::new(BatchLogEventsResponse { count }))
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize structured logging
    tracing_subscriber::fmt::init();
    
    dotenv().ok();
    
    let database_url = env::var("DATABASE_URL")
        .expect("DATABASE_URL environment variable must be set");
    
    let max_connections: u32 = env::var("DB_MAX_CONNECTIONS")
        .unwrap_or_else(|_| "10".to_string())
        .parse()
        .unwrap_or(10);
    
    let pool = PgPoolOptions::new()
        .max_connections(max_connections)
        .connect(&database_url)
        .await?;

    info!("[AuditService] Connected to database with {} max connections", max_connections);

    // Setup health check
    let (mut health_reporter, health_service) = health_reporter();
    health_reporter.set_serving::<AuditServiceServer<MyAuditService>>().await;

    let addr = "0.0.0.0:50051".parse()?;
    let service = MyAuditService { pool };

    info!("[AuditService] Listening on {}", addr);

    // Graceful shutdown handling
    let server = Server::builder()
        .add_service(health_service)
        .add_service(AuditServiceServer::new(service))
        .serve_with_shutdown(addr, async {
            tokio::signal::ctrl_c().await.ok();
            info!("[AuditService] Received shutdown signal, gracefully stopping...");
        });

    server.await?;
    info!("[AuditService] Server stopped");

    Ok(())
}
