export interface Schema {
  /**
   * The name of the reducer.
   */
  name: string;

  /**
   * The path to create the reducer.
   */
  path?: string;

  /**
   * The name of the project.
   */
  project?: string;

  /**
   * When true (the default), creates the files in the path directly;
   * when false, creates them in a folder named after the reducer.
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
   * The reducers file (path) to add the reducer to.
   */
  reducers?: string;

  /**
   * When true, creates the reducer within a 'reducers' folder.
   */
  group?: boolean;

  /**
   * When true, the reducer handles the feature's actions (from the action
   * schematic) and is exported through `createFeature`, as the feature
   * schematic generates it.
   */
  feature?: boolean;

  /**
   * Specifies if api success and failure actions
   * should be added to the reducer (with `feature`).
   */
  api?: boolean;

  /**
   * The prefix of the action the reducer handles (with `feature`).
   */
  prefix?: string;
}
