use crate::models::Message;
use anyhow::Result;
use uuid::Uuid;

pub async fn save_message(pool: &Option<deadpool_postgres::Pool>, message: &Message) -> Result<()> {
    let pool = match pool {
        Some(p) => p,
        None => {
            tracing::warn!("Database pool not available, message not persisted");
            return Ok(());
        }
    };

    let client = pool.get().await?;
    
    client.execute(
        "INSERT INTO messages (id, channel_id, user_id, content, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET content = $4, updated_at = $6",
        &[
            &message.id,
            &message.channel_id,
            &message.user_id,
            &message.content,
            &message.created_at,
            &message.updated_at,
        ],
    ).await?;

    tracing::debug!("Message saved to database: {}", message.id);
    Ok(())
}

pub async fn get_message(pool: &Option<deadpool_postgres::Pool>, id: &Uuid) -> Result<Option<Message>> {
    let pool = match pool {
        Some(p) => p,
        None => {
            tracing::warn!("Database pool not available");
            return Ok(None);
        }
    };

    let client = pool.get().await?;
    
    let row = client.query_opt(
        "SELECT id, channel_id, user_id, content, created_at, updated_at 
         FROM messages WHERE id = $1",
        &[id],
    ).await?;

    match row {
        Some(row) => Ok(Some(Message {
            id: row.get("id"),
            channel_id: row.get("channel_id"),
            user_id: row.get("user_id"),
            content: row.get("content"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        })),
        None => Ok(None),
    }
}

pub async fn get_messages_by_channel(pool: &Option<deadpool_postgres::Pool>, channel_id: &Uuid) -> Result<Vec<Message>> {
    let pool = match pool {
        Some(p) => p,
        None => {
            tracing::warn!("Database pool not available");
            return Ok(vec![]);
        }
    };

    let client = pool.get().await?;
    
    let rows = client.query(
        "SELECT id, channel_id, user_id, content, created_at, updated_at 
         FROM messages WHERE channel_id = $1 ORDER BY created_at DESC LIMIT 100",
        &[channel_id],
    ).await?;

    let messages: Vec<Message> = rows.iter().map(|row| Message {
        id: row.get("id"),
        channel_id: row.get("channel_id"),
        user_id: row.get("user_id"),
        content: row.get("content"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }).collect();

    Ok(messages)
}

pub async fn delete_message(pool: &Option<deadpool_postgres::Pool>, id: &Uuid) -> Result<bool> {
    let pool = match pool {
        Some(p) => p,
        None => {
            tracing::warn!("Database pool not available");
            return Ok(false);
        }
    };

    let client = pool.get().await?;
    
    let result = client.execute(
        "DELETE FROM messages WHERE id = $1",
        &[id],
    ).await?;

    Ok(result > 0)
}
