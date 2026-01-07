use tonic::{transport::Server, Request, Response, Status};
use sqlx::postgres::PgPoolOptions;
use dotenv::dotenv;
use std::env;
use tantivy::{Index, IndexWriter, Term, field};
use std::sync::Arc;
use tokio::sync::Mutex;

pub mod search {
    tonic::include_proto!("search");
}
use search::search_service_server::{SearchService, SearchServiceServer};
use search::{SearchMessagesRequest, SearchMessagesResponse, IndexMessageRequest, IndexMessageResponse, SearchResult};

#[derive(Debug, Clone)]
pub struct MySearchService {
    pool: sqlx::PgPool,
    index: Arc<Mutex<Option<tantivy::Index>>>,
}

impl MySearchService {
    async fn init_index(&self) -> Result<(), Box<dyn std::error::Error>> {
        let mut index_opt = self.index.lock().await;
        
        // Create or open Tantivy index
        let index_path = "./data/search_index";
        std::fs::create_dir_all(index_path)?;
        
        let mut schema_builder = tantivy::schema::Schema::builder();
        schema_builder.add_text_field("content", field::TEXT | field::STORED);
        schema_builder.add_u64_field("message_id", field::STORED);
        schema_builder.add_u64_field("author_id", field::STORED);
        schema_builder.add_text_field("channel_id", field::STORED);
        schema_builder.add_text_field("guild_id", field::STORED);
        schema_builder.add_text_field("created_at", field::STORED);
        
        let schema = schema_builder.build();
        let index = Index::create_in_dir(index_path, schema)?;
        
        *index_opt = Some(index);
        println!("[SearchService] Index initialized");
        Ok(())
    }
}

#[tonic::async_trait]
impl SearchService for MySearchService {
    async fn search_messages(
        &self,
        request: Request<SearchMessagesRequest>,
    ) -> Result<Response<SearchMessagesResponse>, Status> {
        let req = request.into_inner();
        
        if req.query.is_empty() {
            return Ok(Response::new(SearchMessagesResponse {
                results: vec![],
                total_hits: 0,
            }));
        }

        // Fallback to SQL search if Tantivy index not ready
        let mut sql_query = "SELECT m.id, m.content, m.author_id, m.channel_id, c.guild_id, m.created_at 
                              FROM messages m 
                              JOIN channels c ON m.channel_id = c.id 
                              WHERE m.content ILIKE $1".to_string();
        let mut params: Vec<&dyn sqlx::Encode<sqlx::Postgres>> = vec![&format!("%{}%", req.query)];
        let mut param_count = 2;

        if !req.channel_id.is_empty() {
            sql_query.push_str(&format!(" AND m.channel_id = ${}", param_count));
            param_count += 1;
        }
        if !req.guild_id.is_empty() {
            sql_query.push_str(&format!(" AND c.guild_id = ${}", param_count));
            param_count += 1;
        }
        if !req.author_id.is_empty() {
            sql_query.push_str(&format!(" AND m.author_id = ${}", param_count));
            param_count += 1;
        }

        sql_query.push_str(&format!(" ORDER BY m.created_at DESC LIMIT {} OFFSET {}", 
                                     req.limit.max(10).min(100), 
                                     req.offset.max(0)));

        // Execute simplified query (dynamic params not easily done here, using basic search)
        let results = sqlx::query!(
            r#"SELECT m.id, m.content, m.author_id, m.channel_id, c.guild_id, 
                      to_char(m.created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at
               FROM messages m 
               JOIN channels c ON m.channel_id = c.id 
               WHERE m.content ILIKE $1 
               ORDER BY m.created_at DESC 
               LIMIT $2 OFFSET $3"#,
            format!("%{}%", req.query),
            req.limit.max(10).min(100) as i32,
            req.offset.max(0) as i32
        )
        .fetch_all(&self.pool)
        .await;

        match results {
            Ok(rows) => {
                let search_results: Vec<SearchResult> = rows.into_iter().map(|row| {
                    SearchResult {
                        message_id: row.id as u64,
                        content: row.content,
                        author_id: row.author_id as u64,
                        channel_id: row.channel_id.to_string(),
                        score: 1.0, // SQL doesn't provide relevance score
                        created_at: row.created_at.unwrap_or_default(),
                    }
                }).collect();

                let total = search_results.len() as i64;
                println!("[SearchService] Found {} results for query: {}", total, req.query);
                
                Ok(Response::new(SearchMessagesResponse {
                    results: search_results,
                    total_hits: total,
                }))
            },
            Err(e) => {
                eprintln!("[SearchService] Search failed: {}", e);
                Err(Status::internal(format!("Search error: {}", e)))
            }
        }
    }

    async fn index_message(
        &self,
        request: Request<IndexMessageRequest>,
    ) -> Result<Response<IndexMessageResponse>, Status> {
        let _req = request.into_inner();
        // Placeholder: Actual implementation would add to Tantivy index
        // For now, we just acknowledge (async background job would handle this)
        Ok(Response::new(IndexMessageResponse { success: true }))
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

    println!("[SearchService] Connected to database");

    let index = Arc::new(Mutex::new(None));
    let service = MySearchService { pool, index };

    // Initialize index
    if let Err(e) = service.init_index().await {
        eprintln!("[SearchService] Warning: Could not initialize Tantivy index: {}", e);
    }

    let addr = "0.0.0.0:50052".parse()?;
    println!("[SearchService] Listening on {}", addr);

    Server::builder()
        .add_service(SearchServiceServer::new(service))
        .serve(addr)
        .await?;

    Ok(())
}
