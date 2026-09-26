export interface Schema {
  /**
   * The name of the action.
   */
  name: string;

  /**
   * The prefix for the actions. Defaults to `load`.
   */
  prefix?: string;

  /**
   * The path to create the action file.
   */
  path?: string;

  /**
   * The name of the project.
   */
  project?: string;

  /**
   * When true (the default), creates the file in the path directly;
   * when false, creates it in a folder named after the action.
   */
  flat?: boolean;

  /**
   * Group actions file within 'actions' folder
   */
  group?: boolean;

  /**
   * Specifies if api success and failure actions
   * should be generated.
   */
  api?: boolean;
}
