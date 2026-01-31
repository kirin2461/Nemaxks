use crate::models::Message;
use anyhow::Result;
use uuid::Uuid;
use tokio_postgres::Client;

pub async fn save_message(client: &Client, message: &Message) -> Result<()> {
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

pub async fn get_message(client: &Client, id: &Uuid) -> Result<Option<Message>> {
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

pub async fn get_messages_by_channel(client: &Client, channel_id: &Uuid) -> Result<Vec<Message>> {
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

pub async fn delete_message(client: &Client, id: &Uuid) -> Result<bool> {
    let result = client.execute(
        "DELETE FROM messages WHERE id = $1",
        &[id],
    ).await?;

    Ok(result > 0)
}
