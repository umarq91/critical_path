-- DPSP Flywheel board groups tasks into up to four categories — Demand, Product, Sales,
-- Profit. Optional: most tasks are not part of the flywheel and simply don't appear on that
-- board, so this is a nullable column, not a required classification like gender/status.
create type task_dpsp_category as enum ('demand', 'product', 'sales', 'profit');

alter table tasks add column dpsp_category task_dpsp_category;
