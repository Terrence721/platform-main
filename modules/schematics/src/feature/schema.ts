export interface Schema {
  /**
   * The name of the feature.
   */
  name: string;

  /**
   * The path to create the feature.
   */
  path?: string;

  /**
   * The name of the project.
   */
  project?: string;

  /**
   * When true (the default), creates the files in the path directly;
   * when false, creates them in a folder named after the feature.
   */
  flat?: boolean;

  /**
   * When true, does not create test files.
   */
  skipTests?: boolean;

  /**
   * The NgModule (path) to register the reducer and effects in.
   */
  module?: string;

  /**
   * When true, does not attempt to insert the generated feature into a
   * module, and does not throw if no declaring module can be found.
   */
  skipImport?: boolean;

  /**
   * The reducers file (path) to add the feature reducer to.
   */
  reducers?: string;

  /**
   * When true, puts each file in a folder for its kind: actions, reducers,
   * selectors, effects (and models with an entity).
   */
  group?: boolean;

  /**
   * Specifies if api success and failure actions, reducer, and effects
   * should be generated as part of this feature. Has no effect with `entity`,
   * whose actions have no success or failure actions.
   */
  api?: boolean;

  /**
   * The prefix of the action, effect and reducer. Has no effect with
   * `entity`, whose actions have fixed names.
   */
  prefix?: string;

  /**
   * When true, creates an @ngrx/entity model, actions and reducer (instead of
   * the action, reducer and selector schematics), and an effect that uses
   * those actions.
   */
  entity?: boolean;
}
