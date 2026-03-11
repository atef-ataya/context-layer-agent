import { z } from 'zod';

export const SkillDefinitionSchema = z.object({
  name: z.string(),
  description: z.string(),
  input_schema: z.object({
    type: z.literal('object'),
    properties: z.record(z.any()),
    required: z.array(z.string()).optional(),
  }),
});

export type SkillDefinition = z.infer<typeof SkillDefinitionSchema>;

export interface SkillExecutor {
  execute(params: Record<string, any>): Promise<string>;
}

export class SkillLoader {
  private skills: Map<string, { definition: SkillDefinition; executor: SkillExecutor }> = new Map();

  registerSkill(definition: SkillDefinition, executor: SkillExecutor): void {
    this.skills.set(definition.name, { definition, executor });
  }

  getSkillDefinitions(): SkillDefinition[] {
    return Array.from(this.skills.values()).map((s) => s.definition);
  }

  async executeSkill(name: string, params: Record<string, any>): Promise<string> {
    const skill = this.skills.get(name);
    if (!skill) {
      throw new Error(`Skill not found: ${name}`);
    }
    return await skill.executor.execute(params);
  }

  hasSkill(name: string): boolean {
    return this.skills.has(name);
  }
}
