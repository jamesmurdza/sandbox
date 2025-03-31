ALTER TABLE "user" ALTER COLUMN "links" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "links" TYPE json USING links::json;--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "links" SET DEFAULT '[]'::json;--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "links" SET NOT NULL;