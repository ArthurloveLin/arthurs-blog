CREATE OR REPLACE FUNCTION public.apply_comment_reaction(
  p_comment_id uuid,
  p_identity text,
  p_reaction smallint
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  normalized_identity text := btrim(coalesce(p_identity, ''));
  normalized_reaction smallint := CASE
    WHEN p_reaction = 1 THEN 1
    WHEN p_reaction = -1 THEN -1
    ELSE 0
  END;
  existing_reaction_id uuid;
  existing_reaction_value smallint;
  next_upvotes integer := 0;
  next_downvotes integer := 0;
BEGIN
  IF normalized_identity = '' THEN
    RAISE EXCEPTION 'MISSING_IDENTITY';
  END IF;

  PERFORM 1
  FROM public.comments
  WHERE id = p_comment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

  SELECT id, value
  INTO existing_reaction_id, existing_reaction_value
  FROM public.comment_reactions
  WHERE comment_id = p_comment_id
    AND identity = normalized_identity
  LIMIT 1;

  IF normalized_reaction = 0 THEN
    IF existing_reaction_id IS NOT NULL THEN
      DELETE FROM public.comment_reactions
      WHERE id = existing_reaction_id;
    END IF;
  ELSIF existing_reaction_id IS NOT NULL THEN
    IF existing_reaction_value IS DISTINCT FROM normalized_reaction THEN
      UPDATE public.comment_reactions
      SET value = normalized_reaction
      WHERE id = existing_reaction_id;
    END IF;
  ELSE
    INSERT INTO public.comment_reactions (comment_id, identity, value)
    VALUES (p_comment_id, normalized_identity, normalized_reaction);
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE value = 1),
    COUNT(*) FILTER (WHERE value = -1)
  INTO next_upvotes, next_downvotes
  FROM public.comment_reactions
  WHERE comment_id = p_comment_id;

  UPDATE public.comments
  SET upvotes = COALESCE(next_upvotes, 0),
      downvotes = COALESCE(next_downvotes, 0)
  WHERE id = p_comment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_comment_reaction(uuid, text, smallint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_comment_reaction(uuid, text, smallint) TO service_role;


CREATE OR REPLACE FUNCTION public.apply_comment_emoji_reaction(
  p_comment_id uuid,
  p_identity text,
  p_emoji text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  normalized_identity text := btrim(coalesce(p_identity, ''));
  normalized_emoji text := btrim(coalesce(p_emoji, ''));
  existing_reaction_id uuid;
BEGIN
  IF normalized_identity = '' THEN
    RAISE EXCEPTION 'MISSING_IDENTITY';
  END IF;

  IF normalized_emoji = '' OR char_length(normalized_emoji) > 24 THEN
    RAISE EXCEPTION 'INVALID_EMOJI';
  END IF;

  PERFORM 1
  FROM public.comments
  WHERE id = p_comment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

  SELECT id
  INTO existing_reaction_id
  FROM public.comment_emoji_reactions
  WHERE comment_id = p_comment_id
    AND identity = normalized_identity
    AND emoji = normalized_emoji
  LIMIT 1;

  IF existing_reaction_id IS NOT NULL THEN
    DELETE FROM public.comment_emoji_reactions
    WHERE id = existing_reaction_id;
  ELSE
    INSERT INTO public.comment_emoji_reactions (comment_id, identity, emoji)
    VALUES (p_comment_id, normalized_identity, normalized_emoji);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_comment_emoji_reaction(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_comment_emoji_reaction(uuid, text, text) TO service_role;