import { TASK_IMPORT_TEMPLATE_HEADERS, REQUIRED_IMPORT_FIELDS, IMPORT_FIELD_BY_HEADER } from "@/app/(app)/tasks/import/task-import-columns";
import { TASK_GRID_COLUMN_ORDER } from "@/app/(app)/tasks/export/task-record-columns";
import { taskCreateSchema } from "@/app/(app)/tasks/schema";
console.log("template:", TASK_IMPORT_TEMPLATE_HEADERS.join(" | "));
console.log("required:", REQUIRED_IMPORT_FIELDS.join(","));
console.log("header map has brand/gender/status:", IMPORT_FIELD_BY_HEADER.has("brand"), IMPORT_FIELD_BY_HEADER.has("gender"), IMPORT_FIELD_BY_HEADER.has("status"));
console.log("export order:", TASK_GRID_COLUMN_ORDER.join(","));
const r = taskCreateSchema.safeParse({ task_name: "x", brand_id: "", gender: "" });
console.log("create errors:", r.success ? "none" : r.error.issues.filter(i => ["brand_id","gender"].includes(String(i.path[0]))).map(i => `${String(i.path[0])}: ${i.message}`).join("; "));
