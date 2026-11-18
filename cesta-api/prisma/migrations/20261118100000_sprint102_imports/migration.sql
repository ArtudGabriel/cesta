-- Sprint 102: CSV import GDPR Art. 20 symmetric (users-export reverse).
-- Two-step dry-run → apply, idempotent dedupe. summary é counts só.

CREATE TABLE "imports" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "dry_run" BOOLEAN NOT NULL DEFAULT true,
    "zip_path" TEXT,
    "summary" JSONB,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "imports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "imports_user_id_created_at_idx" ON "imports"("user_id", "created_at");

ALTER TABLE "imports" ADD CONSTRAINT "imports_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
