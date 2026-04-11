export type GeneratorAnalyticsContext = {
  manifest_id: string;
  manifest_version: string;
  recipe_version?: string;
  mode: string;
  branch: string;
  experiment_key?: string;
  variant_key?: string;
  assignment_source?: "bucket" | "override" | "cookie" | "default";
};
