-- Migration: Add full-text search support for messages
CREATE INDEX IF NOT EXISTS idx_message_content_fts ON messages USING GIN (to_tsvector('english', content));

-- Create a function for common searches
CREATE OR REPLACE FUNCTION search_messages(
    p_query TEXT,
    p_channel_id BIGINT DEFAULT NULL,
    p_guild_id BIGINT DEFAULT NULL,
    p_limit INT DEFAULT 20,
    p_offset INT DEFAULT 0
) RETURNS TABLE(
    id BIGINT,
    content TEXT,
    author_id BIGINT,
    channel_id BIGINT,
    guild_id BIGINT,
    created_at TIMESTAMP,
    relevance_score FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id,
        m.content,
        m.author_id,
        m.channel_id,
        c.guild_id,
        m.created_at,
        ts_rank(to_tsvector('english', m.content), plainto_tsquery('english', p_query))::FLOAT
    FROM messages m
    JOIN channels c ON m.channel_id = c.id
    WHERE to_tsvector('english', m.content) @@ plainto_tsquery('english', p_query)
        AND (p_channel_id IS NULL OR m.channel_id = p_channel_id)
        AND (p_guild_id IS NULL OR c.guild_id = p_guild_id)
    ORDER BY relevance_score DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

COMMIT;
