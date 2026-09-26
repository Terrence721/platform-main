export interface Schema {
  /**
   * The name of the component store.
   */
  name: string;

  /**
   * The path to create the component store.
   */
  path?: string;

  /**
   * The name of the project.
   */
  project?: string;

  /**
   * When true (the default), creates the files in the path directly;
   * when false, creates them in a folder named after the component store.
   */
  flat?: boolean;

  /**
   * When true, does not create test files.
   */
  skipTests?: boolean;

  /**
   * The component (path) to provide the component store in.
   */
  component?: string;

  /**
   * The NgModule (path) to provide the component store in.
   */
  module?: string;
}
