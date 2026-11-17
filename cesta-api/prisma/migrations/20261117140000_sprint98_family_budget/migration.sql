-- Sprint 98: family basket budget as soft constraint for generator heuristic
ALTER TABLE "family_profiles"
ADD COLUMN "monthly_budget" DECIMAL(10, 2);
