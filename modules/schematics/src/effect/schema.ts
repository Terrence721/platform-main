export interface Schema {
  /**
   * The name of the effect. Not needed with `root` and `minimal`, which only
   * register `EffectsModule.forRoot([])`.
   */
  name?: string;

  /**
   * The path to create the effect.
   */
  path?: string;

  /**
   * The name of the project.
   */
  project?: string;

  /**
   * When true (the default), creates the files in the path directly;
   * when false, creates them in a folder named after the effect.
   */
  flat?: boolean;

  /**
   * When true, does not create test files.
   */
  skipTests?: boolean;

  /**
   * The NgModule (path) to register the effects in.
   */
  module?: string;

  /**
   * Specifies if the effects are registered with `EffectsModule.forRoot`.
   */
  root?: boolean;

  /**
   * When true, generates a sample effect wired to the feature's actions, as
   * the feature schematic does.
   */
  feature?: boolean;

  /**
   * Specifies if this is grouped within an 'effects' folder.
   */
  group?: boolean;

  /**
   * Specifies if effect has api success and failure actions wired up.
   */
  api?: boolean;

  /**
   * Setup root effects module without registering initial effects.
   */
  minimal?: boolean;

  /**
   * The prefix for the effects.
   */
  prefix?: string;
}
