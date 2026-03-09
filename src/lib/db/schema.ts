import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const days = sqliteTable('days', {
  date: text('date').primaryKey(),
  dayType: text('day_type').notNull(),
  note: text('note'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const publicHolidays = sqliteTable('public_holidays', {
  date: text('date').primaryKey(),
  name: text('name').notNull(),
  canton: text('canton').notNull(),
  year: integer('year').notNull(),
  global: integer('global').notNull(),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  colour: text('colour').notNull(), // hex e.g. '#6366f1'
  startDate: text('start_date'),    // nullable, YYYY-MM-DD
  endDate: text('end_date'),        // nullable, YYYY-MM-DD
  weekdays: text('weekdays').notNull(), // JSON array e.g. '[1,2,3,4]'
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
