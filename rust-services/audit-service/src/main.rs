use tonic::{transport::Server, Request, Response, Status};
use sqlx::postgres::PgPoolOptions;
use dotenv::dotenv;
use std::env;
use chrono::Utc;

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
        
        let result = sqlx::query!(
            r#"INSERT INTO extended_audit_logs 
               (user_id, action, target_type, target_id, scope, details, ip_address, user_agent, created_at) 
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) 
               RETURNING id"#,
            req.user_id as i64,
            &req.action,
            &req.target_type,
            &req.target_id,
            &req.scope,
            &req.details,
            &req.ip_address,
            &req.user_agent
        )
        .fetch_one(&self.pool)
        .await;

        match result {
            Ok(record) => {
                println!("[AuditService] Logged event with id={}", record.id);
                Ok(Response::new(LogEventResponse {
                    success: true,
                    id: record.id as u64,
                }))
            },
            Err(e) => {
                eprintln!("[AuditService] Failed to log event: {}", e);
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

        // Build dynamic query based on filters
        let mut query = "SELECT id, user_id, action, target_type, target_id, scope, details, ip_address, created_at 
                         FROM extended_audit_logs WHERE 1=1".to_string();
        let mut count_query = "SELECT COUNT(*) as cnt FROM extended_audit_logs WHERE 1=1".to_string();
        
        let mut filters = Vec::new();
        
        if req.user_id != 0 {
            filters.push(format!(" AND user_id = {}", req.user_id));
        }
        if !req.action.is_empty() {
            filters.push(format!(" AND action = '{}'", req.action));
        }

        for filter in &filters {
            query.push_str(filter);
            count_query.push_str(filter);
        }

        query.push_str(&format!(" ORDER BY created_at DESC LIMIT {} OFFSET {}", limit, offset));

        let logs_result = sqlx::query!(
            r#"SELECT id, user_id, action, target_type, target_id, scope, details, ip_address, 
                      to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at
               FROM extended_audit_logs 
               ORDER BY created_at DESC LIMIT $1 OFFSET $2"#,
            limit,
            offset
        )
        .fetch_all(&self.pool)
        .await;

        let count_result = sqlx::query!("SELECT COUNT(*) as cnt FROM extended_audit_logs")
            .fetch_one(&self.pool)
            .await;

        match (logs_result, count_result) {
            (Ok(logs), Ok(count_row)) => {
                let audit_logs: Vec<AuditLogEntry> = logs.into_iter().map(|row| {
                    AuditLogEntry {
                        id: row.id as u64,
                        user_id: row.user_id as u64,
                        action: row.action,
                        target_type: row.target_type,
                        target_id: row.target_id,
                        scope: row.scope,
                        details: row.details,
                        ip_address: row.ip_address,
                        created_at: row.created_at.unwrap_or_default(),
                    }
                }).collect();

                Ok(Response::new(GetLogsResponse {
                    logs: audit_logs,
                    total: count_row.cnt.unwrap_or(0),
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
            let result = sqlx::query!(
                r#"INSERT INTO extended_audit_logs 
                   (user_id, action, target_type, target_id, scope, details, ip_address, user_agent, created_at) 
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())"#,
                event.user_id as i64,
                &event.action,
                &event.target_type,
                &event.target_id,
                &event.scope,
                &event.details,
                &event.ip_address,
                &event.user_agent
            )
            .execute(&mut *tx)
            .await;

            if result.is_ok() {
                count += 1;
            }
        }

        tx.commit().await
            .map_err(|e| Status::internal(format!("Transaction commit failed: {}", e)))?;

        println!("[AuditService] Batch logged {} events", count);
        Ok(Response::new(BatchLogEventsResponse { count }))
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv().ok();
    
    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://user:password@localhost:5432/nemaks".to_string());
    
    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(&database_url)
        .await?;

    println!("[AuditService] Connected to database");

    let addr = "0.0.0.0:50051".parse()?;
    let service = MyAuditService { pool };

    println!("[AuditService] Listening on {}", addr);

    Server::builder()
        .add_service(AuditServiceServer::new(service))
        .serve(addr)
        .await?;

    Ok(())
}
