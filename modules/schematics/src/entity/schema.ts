export interface Schema {
  /**
   * The name of the entity.
   */
  name: string;

  /**
   * The path to create the entity files.
   */
  path?: string;

  /**
   * The name of the project.
   */
  project?: string;

  /**
   * When true (the default), creates the files in the path directly;
   * when false, creates them in a folder named after the entity.
   */
  flat?: boolean;

  /**
   * When true, does not create test files.
   */
  skipTests?: boolean;

  /**
   * The NgModule (path) to register the reducer in. Without it, the nearest
   * NgModule is used, if the app has one.
   */
  module?: string;

  /**
   * The reducers file (path) to add the entity reducer to.
   */
  reducers?: string;

  /**
   * When true, puts the actions, model and reducer in 'actions', 'models'
   * and 'reducers' folders.
   */
  group?: boolean;

  /**
   * Set by the feature schematic. It does not change what this schematic
   * generates.
   */
  feature?: boolean;
}
