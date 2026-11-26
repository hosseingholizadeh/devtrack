CREATE TYPE "public"."project_status" AS ENUM('active', 'completed', 'archived');--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" "project_status" DEFAULT 'active' NOT NULL,
	"start_date" date,
	"due_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_name_not_blank" CHECK (length(btrim("projects"."name")) > 0),
	CONSTRAINT "projects_due_date_after_start_date" CHECK ("projects"."start_date" is null or "projects"."due_date" is null or "projects"."due_date" >= "projects"."start_date")
);
