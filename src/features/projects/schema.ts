import { sql } from "drizzle-orm";
import { check, date, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const projectStatuses = ["active", "completed", "archived"] as const;
export type ProjectStatus = (typeof projectStatuses)[number];

export const projectStatusEnum = pgEnum("project_status", projectStatuses);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    status: projectStatusEnum("status").notNull().default("active"),
    // `date` columns are calendar dates without a time zone: keep them as "YYYY-MM-DD" strings.
    startDate: date("start_date", { mode: "string" }),
    dueDate: date("due_date", { mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("projects_name_not_blank", sql`length(btrim(${table.name})) > 0`),
    check(
      "projects_due_date_after_start_date",
      sql`${table.startDate} is null or ${table.dueDate} is null or ${table.dueDate} >= ${table.startDate}`,
    ),
  ],
);

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
