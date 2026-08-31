import type { LessonBlock, LessonBlockType } from "./blocks";
import { newBlock, type IdSource } from "./drafts";

/** Semantic presets and custom groups share the same primitive vocabulary. */
export const LESSON_BLOCK_RECIPES = {
  lesson_objective: ["lesson_objective"],
  protocol_step: ["protocol_step", "rich_text"],
  practice_block: ["practice_block", "rich_text"],
  checklist: ["checklist"],
  faq_block: ["faq_block"],
  boundary_note: ["boundary_note"],
} satisfies Partial<Record<LessonBlockType, LessonBlockType[]>>;

export function newBlockRecipe(type: LessonBlockType, ids: IdSource): LessonBlock {
  const recipe = (LESSON_BLOCK_RECIPES as Partial<Record<LessonBlockType, LessonBlockType[]>>)[type];
  return recipe
    ? { id: ids(), type: "group", children: recipe.map((kind) => newBlock(kind, ids)) }
    : newBlock(type, ids);
}
