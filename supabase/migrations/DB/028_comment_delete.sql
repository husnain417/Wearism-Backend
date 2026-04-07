-- When a parent comment is soft-deleted, soft-delete all its replies too
CREATE OR REPLACE FUNCTION public.cascade_soft_delete_replies()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    UPDATE public.post_comments
    SET deleted_at = NEW.deleted_at
    WHERE parent_id = NEW.id
      AND deleted_at IS NULL;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_cascade_soft_delete_replies
  AFTER UPDATE ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete_replies();