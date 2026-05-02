CREATE OR REPLACE FUNCTION apply_post_reaction_batch(target_post_id uuid, mutations jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_upvotes integer := 0;
  next_downvotes integer := 0;
BEGIN
  DELETE FROM post_reactions AS existing
  USING (
    WITH parsed AS (
      SELECT
        trim(item.value->>'identity') AS identity,
        item.ordinality AS ordinality,
        CASE item.value->>'reaction'
          WHEN '1' THEN 1
          WHEN '-1' THEN -1
          ELSE 0
        END AS reaction
      FROM jsonb_array_elements(COALESCE(mutations, '[]'::jsonb)) WITH ORDINALITY AS item(value, ordinality)
    ),
    deduped AS (
      SELECT DISTINCT ON (identity)
        identity,
        reaction
      FROM parsed
      WHERE identity <> ''
      ORDER BY identity, ordinality DESC
    )
    SELECT identity
    FROM deduped
    WHERE reaction = 0
  ) AS pending_delete
  WHERE existing.post_id = target_post_id
    AND existing.identity = pending_delete.identity;

  INSERT INTO post_reactions (post_id, identity, value)
  SELECT target_post_id, pending_upsert.identity, pending_upsert.reaction
  FROM (
    WITH parsed AS (
      SELECT
        trim(item.value->>'identity') AS identity,
        item.ordinality AS ordinality,
        CASE item.value->>'reaction'
          WHEN '1' THEN 1
          WHEN '-1' THEN -1
          ELSE 0
        END AS reaction
      FROM jsonb_array_elements(COALESCE(mutations, '[]'::jsonb)) WITH ORDINALITY AS item(value, ordinality)
    ),
    deduped AS (
      SELECT DISTINCT ON (identity)
        identity,
        reaction
      FROM parsed
      WHERE identity <> ''
      ORDER BY identity, ordinality DESC
    )
    SELECT identity, reaction
    FROM deduped
    WHERE reaction IN (-1, 1)
  ) AS pending_upsert
  ON CONFLICT (post_id, identity) DO UPDATE
  SET value = EXCLUDED.value,
      updated_at = now();

  SELECT
    COALESCE(COUNT(*) FILTER (WHERE value = 1), 0)::integer,
    COALESCE(COUNT(*) FILTER (WHERE value = -1), 0)::integer
  INTO next_upvotes, next_downvotes
  FROM post_reactions
  WHERE post_id = target_post_id;

  UPDATE posts
  SET upvotes = next_upvotes,
      downvotes = next_downvotes
  WHERE id = target_post_id;

  RETURN jsonb_build_object(
    'upvotes', next_upvotes,
    'downvotes', next_downvotes
  );
END;
$$;

REVOKE ALL ON FUNCTION apply_post_reaction_batch(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION apply_post_reaction_batch(uuid, jsonb) FROM anon;
REVOKE ALL ON FUNCTION apply_post_reaction_batch(uuid, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION apply_post_reaction_batch(uuid, jsonb) TO service_role;