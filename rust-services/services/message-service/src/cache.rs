use anyhow::Result;
use redis::AsyncCommands;

const MESSAGE_CACHE_TTL: u64 = 3600;

pub async fn cache_message(redis: &Option<redis::aio::ConnectionManager>, key: &str, value: &str) -> Result<()> {
    let redis = match redis {
        Some(r) => r,
        None => {
            tracing::debug!("Redis not available, skipping cache");
            return Ok(());
        }
    };

    let mut conn = redis.clone();
    let cache_key = format!("message:{}", key);
    
    conn.set_ex::<_, _, ()>(&cache_key, value, MESSAGE_CACHE_TTL).await?;
    
    tracing::debug!("Message cached: {}", key);
    Ok(())
}

pub async fn get_cached(redis: &Option<redis::aio::ConnectionManager>, key: &str) -> Result<Option<String>> {
    let redis = match redis {
        Some(r) => r,
        None => {
            tracing::debug!("Redis not available");
            return Ok(None);
        }
    };

    let mut conn = redis.clone();
    let cache_key = format!("message:{}", key);
    
    let result: Option<String> = conn.get(&cache_key).await?;
    
    if result.is_some() {
        tracing::debug!("Cache hit: {}", key);
    }
    
    Ok(result)
}

pub async fn invalidate_cache(redis: &Option<redis::aio::ConnectionManager>, key: &str) -> Result<()> {
    let redis = match redis {
        Some(r) => r,
        None => return Ok(()),
    };

    let mut conn = redis.clone();
    let cache_key = format!("message:{}", key);
    
    conn.del::<_, ()>(&cache_key).await?;
    
    tracing::debug!("Cache invalidated: {}", key);
    Ok(())
}

pub async fn cache_channel_messages(redis: &Option<redis::aio::ConnectionManager>, channel_id: &str, messages_json: &str) -> Result<()> {
    let redis = match redis {
        Some(r) => r,
        None => return Ok(()),
    };

    let mut conn = redis.clone();
    let cache_key = format!("channel:{}:messages", channel_id);
    
    conn.set_ex::<_, _, ()>(&cache_key, messages_json, 300).await?;
    
    Ok(())
}
