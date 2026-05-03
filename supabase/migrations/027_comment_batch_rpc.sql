CREATE OR REPLACE FUNCTION apply_comment_batch(comments jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  comment_entry jsonb;
  processed_count integer := 0;
BEGIN
  IF comments IS NULL OR jsonb_typeof(comments) <> 'array' THEN
    RAISE EXCEPTION 'comments must be a JSON array';
  END IF;

  FOR comment_entry IN
    SELECT value
    FROM jsonb_array_elements(comments) AS value
  LOOP
    INSERT INTO comments (
      id,
      target_type,
      target_id,
      item_id,
      author,
      content,
      parent_id,
      created_at,
      updated_at,
      upvotes,
      downvotes
    )
    VALUES (
      (comment_entry->>'id')::uuid,
      comment_entry->>'target_type',
      (comment_entry->>'target_id')::uuid,
      CASE
        WHEN comment_entry->>'target_type' = 'wardrobe_item' THEN (comment_entry->>'target_id')::uuid
        ELSE NULL
      END,
      comment_entry->>'author',
      comment_entry->>'content',
      NULLIF(comment_entry->>'parent_id', '')::uuid,
      COALESCE((comment_entry->>'created_at')::timestamptz, now()),
      NULLIF(comment_entry->>'updated_at', '')::timestamptz,
      0,
      0
    )
    ON CONFLICT (id) DO UPDATE
    SET
      target_type = EXCLUDED.target_type,
      target_id = EXCLUDED.target_id,
      item_id = EXCLUDED.item_id,
      author = EXCLUDED.author,
      content = EXCLUDED.content,
      parent_id = EXCLUDED.parent_id,
      created_at = EXCLUDED.created_at,
      updated_at = EXCLUDED.updated_at;

    processed_count := processed_count + 1;
  END LOOP;

  RETURN processed_count;
END;
$$;