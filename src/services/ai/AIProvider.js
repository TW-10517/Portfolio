// Contract every AI script-writing provider must implement.
// A provider only ever sees a "brief" — real fields pulled from the user's
// portfolio — and must return prose built from those fields. It must never
// invent companies, projects, numbers, or skills that aren't in the brief.
export class AIProvider {
  get name() {
    throw new Error("AIProvider.name not implemented");
  }

  get requiresApiKey() {
    return false;
  }

  async isAvailable() {
    return true;
  }

  // brief: plain-object facts for one scene (see sceneBuilder.js)
  // sceneType: 'intro' | 'about' | 'skills' | 'experience' | 'project' | 'education' | 'achievements' | 'testimonial' | 'closing'
  // options: { style, audience, language, maxWords, customInstruction }
  // Returns: Promise<string> narration text for that scene.
  // eslint-disable-next-line no-unused-vars
  async writeScript(brief, sceneType, options) {
    throw new Error("AIProvider.writeScript not implemented");
  }
}
