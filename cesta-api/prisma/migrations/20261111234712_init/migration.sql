-- CreateEnum
CREATE TYPE "measure_unit" AS ENUM ('liter', 'milliliter', 'kilogram', 'gram', 'unit');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "password_hash" TEXT NOT NULL,
    "name" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'es',
    "roles" TEXT[] DEFAULT ARRAY['user']::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "user_agent" TEXT,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supermarkets" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "logo_url" TEXT,
    "website" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supermarkets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name_es" TEXT NOT NULL,
    "name_pt" TEXT NOT NULL,
    "parent_id" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "brand" TEXT,
    "description" TEXT,
    "image_url" TEXT,
    "ean" TEXT,
    "package_size" DECIMAL(10,3) NOT NULL,
    "package_unit" "measure_unit" NOT NULL,
    "comparison_unit" "measure_unit" NOT NULL,
    "nutrition_per" DECIMAL(6,2),
    "calories" DECIMAL(7,2),
    "protein" DECIMAL(6,2),
    "carbs" DECIMAL(6,2),
    "sugar" DECIMAL(6,2),
    "fat" DECIMAL(6,2),
    "saturated_fat" DECIMAL(6,2),
    "fiber" DECIMAL(6,2),
    "salt" DECIMAL(6,2),
    "is_vegan" BOOLEAN NOT NULL DEFAULT false,
    "is_vegetarian" BOOLEAN NOT NULL DEFAULT false,
    "is_gluten_free" BOOLEAN NOT NULL DEFAULT false,
    "is_lactose_free" BOOLEAN NOT NULL DEFAULT false,
    "category_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_prices" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "supermarket_id" TEXT NOT NULL,
    "current_price" DECIMAL(10,2) NOT NULL,
    "previous_price" DECIMAL(10,2),
    "on_promotion" BOOLEAN NOT NULL DEFAULT false,
    "promotion_ends" TIMESTAMP(3),
    "confidence_score" DECIMAL(3,2) NOT NULL DEFAULT 1.00,
    "source" TEXT NOT NULL DEFAULT 'seed',
    "is_stale" BOOLEAN NOT NULL DEFAULT false,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "last_synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_snapshots" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "supermarket_id" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "on_promotion" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shopping_lists" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "shopping_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shopping_list_items" (
    "id" TEXT NOT NULL,
    "list_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL DEFAULT 1,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shopping_list_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" VARCHAR(1000),
    "helpful_count" INTEGER NOT NULL DEFAULT 0,
    "reported_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_helpfuls" (
    "id" TEXT NOT NULL,
    "review_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_helpfuls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dietary_questions" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label_es" TEXT NOT NULL,
    "label_pt" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "options" JSONB,
    "category" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "dietary_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "members" JSONB NOT NULL,
    "answers" JSONB NOT NULL,
    "restrictions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "blocked_categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "required_product_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "family_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_baskets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "family_profile_id" TEXT NOT NULL,
    "estimated_cost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error_message" TEXT,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "family_baskets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_basket_items" (
    "id" TEXT NOT NULL,
    "basket_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "family_basket_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_candidates" (
    "id" TEXT NOT NULL,
    "raw_name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "brand" TEXT,
    "ean" TEXT,
    "supermarket_slug" TEXT NOT NULL,
    "reported_price" DECIMAL(10,2) NOT NULL,
    "package_hint" TEXT,
    "category_hint" TEXT,
    "confirmations" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "supermarket_id" TEXT,
    "supermarket_slug" TEXT,
    "purchase_date" TIMESTAMP(3),
    "total" DECIMAL(10,2),
    "image_url" TEXT,
    "ocr_raw_text" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error_message" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipt_items" (
    "id" TEXT NOT NULL,
    "receipt_id" TEXT NOT NULL,
    "raw_text" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "product_id" TEXT,
    "category_hint" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "receipt_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_discrepancies" (
    "id" TEXT NOT NULL,
    "product_price_id" TEXT NOT NULL,
    "reported_price" DECIMAL(10,2) NOT NULL,
    "reported_by_user_id" TEXT NOT NULL,
    "receipt_id" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_discrepancies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "supermarket_id" TEXT,
    "type" TEXT NOT NULL,
    "target_price" DECIMAL(10,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_triggered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_triggers" (
    "id" TEXT NOT NULL,
    "alert_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "price_snapshot" DECIMAL(10,2) NOT NULL,
    "notified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_triggers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_runs" (
    "id" TEXT NOT NULL,
    "supermarket_slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "items_processed" INTEGER NOT NULL DEFAULT 0,
    "items_created" INTEGER NOT NULL DEFAULT 0,
    "items_updated" INTEGER NOT NULL DEFAULT 0,
    "items_candidate" INTEGER NOT NULL DEFAULT 0,
    "items_failed" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_revoked_at_idx" ON "refresh_tokens"("user_id", "revoked_at");

-- CreateIndex
CREATE UNIQUE INDEX "supermarkets_slug_key" ON "supermarkets"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_parent_id_idx" ON "categories"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_normalized_name_key" ON "products"("normalized_name");

-- CreateIndex
CREATE UNIQUE INDEX "products_ean_key" ON "products"("ean");

-- CreateIndex
CREATE INDEX "products_normalized_name_idx" ON "products"("normalized_name");

-- CreateIndex
CREATE INDEX "products_category_id_deleted_at_idx" ON "products"("category_id", "deleted_at");

-- CreateIndex
CREATE INDEX "products_brand_idx" ON "products"("brand");

-- CreateIndex
CREATE INDEX "product_prices_supermarket_id_last_synced_at_idx" ON "product_prices"("supermarket_id", "last_synced_at");

-- CreateIndex
CREATE INDEX "product_prices_on_promotion_is_available_idx" ON "product_prices"("on_promotion", "is_available");

-- CreateIndex
CREATE UNIQUE INDEX "product_prices_product_id_supermarket_id_key" ON "product_prices"("product_id", "supermarket_id");

-- CreateIndex
CREATE INDEX "price_snapshots_product_id_supermarket_id_captured_at_idx" ON "price_snapshots"("product_id", "supermarket_id", "captured_at");

-- CreateIndex
CREATE INDEX "shopping_lists_user_id_deleted_at_idx" ON "shopping_lists"("user_id", "deleted_at");

-- CreateIndex
CREATE INDEX "shopping_list_items_list_id_idx" ON "shopping_list_items"("list_id");

-- CreateIndex
CREATE UNIQUE INDEX "shopping_list_items_list_id_product_id_key" ON "shopping_list_items"("list_id", "product_id");

-- CreateIndex
CREATE INDEX "reviews_product_id_deleted_at_idx" ON "reviews"("product_id", "deleted_at");

-- CreateIndex
CREATE INDEX "reviews_created_at_idx" ON "reviews"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_user_id_product_id_key" ON "reviews"("user_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "review_helpfuls_review_id_user_id_key" ON "review_helpfuls"("review_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "dietary_questions_key_key" ON "dietary_questions"("key");

-- CreateIndex
CREATE UNIQUE INDEX "family_profiles_user_id_key" ON "family_profiles"("user_id");

-- CreateIndex
CREATE INDEX "family_baskets_user_id_deleted_at_idx" ON "family_baskets"("user_id", "deleted_at");

-- CreateIndex
CREATE INDEX "family_basket_items_basket_id_idx" ON "family_basket_items"("basket_id");

-- CreateIndex
CREATE UNIQUE INDEX "family_basket_items_basket_id_product_id_key" ON "family_basket_items"("basket_id", "product_id");

-- CreateIndex
CREATE INDEX "product_candidates_status_created_at_idx" ON "product_candidates"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "product_candidates_normalized_name_supermarket_slug_key" ON "product_candidates"("normalized_name", "supermarket_slug");

-- CreateIndex
CREATE INDEX "receipts_user_id_purchase_date_idx" ON "receipts"("user_id", "purchase_date");

-- CreateIndex
CREATE INDEX "receipts_user_id_deleted_at_idx" ON "receipts"("user_id", "deleted_at");

-- CreateIndex
CREATE INDEX "receipts_status_idx" ON "receipts"("status");

-- CreateIndex
CREATE INDEX "receipt_items_receipt_id_idx" ON "receipt_items"("receipt_id");

-- CreateIndex
CREATE INDEX "receipt_items_product_id_idx" ON "receipt_items"("product_id");

-- CreateIndex
CREATE INDEX "price_discrepancies_product_price_id_resolved_idx" ON "price_discrepancies"("product_price_id", "resolved");

-- CreateIndex
CREATE INDEX "alerts_user_id_is_active_deleted_at_idx" ON "alerts"("user_id", "is_active", "deleted_at");

-- CreateIndex
CREATE INDEX "alerts_product_id_is_active_idx" ON "alerts"("product_id", "is_active");

-- CreateIndex
CREATE INDEX "alert_triggers_alert_id_created_at_idx" ON "alert_triggers"("alert_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_user_id_idx" ON "push_subscriptions"("user_id");

-- CreateIndex
CREATE INDEX "sync_runs_supermarket_slug_started_at_idx" ON "sync_runs"("supermarket_slug", "started_at");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_supermarket_id_fkey" FOREIGN KEY ("supermarket_id") REFERENCES "supermarkets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_snapshots" ADD CONSTRAINT "price_snapshots_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_snapshots" ADD CONSTRAINT "price_snapshots_supermarket_id_fkey" FOREIGN KEY ("supermarket_id") REFERENCES "supermarkets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopping_lists" ADD CONSTRAINT "shopping_lists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopping_list_items" ADD CONSTRAINT "shopping_list_items_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "shopping_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopping_list_items" ADD CONSTRAINT "shopping_list_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_helpfuls" ADD CONSTRAINT "review_helpfuls_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_helpfuls" ADD CONSTRAINT "review_helpfuls_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_profiles" ADD CONSTRAINT "family_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_baskets" ADD CONSTRAINT "family_baskets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_baskets" ADD CONSTRAINT "family_baskets_family_profile_id_fkey" FOREIGN KEY ("family_profile_id") REFERENCES "family_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_basket_items" ADD CONSTRAINT "family_basket_items_basket_id_fkey" FOREIGN KEY ("basket_id") REFERENCES "family_baskets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_basket_items" ADD CONSTRAINT "family_basket_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_supermarket_id_fkey" FOREIGN KEY ("supermarket_id") REFERENCES "supermarkets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_items" ADD CONSTRAINT "receipt_items_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_items" ADD CONSTRAINT "receipt_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_discrepancies" ADD CONSTRAINT "price_discrepancies_product_price_id_fkey" FOREIGN KEY ("product_price_id") REFERENCES "product_prices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_discrepancies" ADD CONSTRAINT "price_discrepancies_reported_by_user_id_fkey" FOREIGN KEY ("reported_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_discrepancies" ADD CONSTRAINT "price_discrepancies_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "receipts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_supermarket_id_fkey" FOREIGN KEY ("supermarket_id") REFERENCES "supermarkets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_triggers" ADD CONSTRAINT "alert_triggers_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "alerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
