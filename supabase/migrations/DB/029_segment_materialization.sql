ALTER TABLE public.wardrobe_items
  ADD COLUMN IF NOT EXISTS source_ai_result_id UUID REFERENCES public.ai_results(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_upload_item_id UUID REFERENCES public.wardrobe_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS segment_index INT,
  ADD COLUMN IF NOT EXISTS source_image_url TEXT,
  ADD COLUMN IF NOT EXISTS source_image_path TEXT,
  ADD COLUMN IF NOT EXISTS is_source_upload BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.ai_results
  ADD COLUMN IF NOT EXISTS materialized_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS materialization_error TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_wardrobe_items_source_segment
  ON public.wardrobe_items(source_upload_item_id, segment_index);

CREATE INDEX IF NOT EXISTS idx_wardrobe_items_source_upload
  ON public.wardrobe_items(source_upload_item_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ai_results_materialization_pending
  ON public.ai_results(task_type, status, materialized_at, created_at DESC);
