export interface Schema {
  /**
   * The name of the selector.
   */
  name: string;

  /**
   * The path to create the selector.
   */
  path?: string;

  /**
   * The name of the project.
   */
  project?: string;

  /**
   * When true (the default), creates the files in the path directly;
   * when false, creates them in a folder named after the selector.
   */
  flat?: boolean;

  /**
   * When true, does not create test files.
   */
  skipTests?: boolean;

  /**
   * When true, selects the state of the reducer the feature schematic creates
   * (typed by its `State`); without it, the feature state is typed `unknown`.
   */
  feature?: boolean;

  /**
   * When true, creates the selector files within a 'selectors' folder.
   */
  group?: boolean;
}
