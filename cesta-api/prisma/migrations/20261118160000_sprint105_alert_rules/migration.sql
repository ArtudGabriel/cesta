-- Sprint 105 — AlertRule (combo/trend/bundle). Ver ADR-0005.

CREATE TABLE "alert_rules" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "rules" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_notified_at" TIMESTAMP(3),
    "last_notified_hash" TEXT,
    "last_triggered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "alert_rules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "alert_rules_user_id_is_active_deleted_at_idx"
    ON "alert_rules"("user_id", "is_active", "deleted_at");

CREATE INDEX "alert_rules_type_is_active_deleted_at_idx"
    ON "alert_rules"("type", "is_active", "deleted_at");

ALTER TABLE "alert_rules"
    ADD CONSTRAINT "alert_rules_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
