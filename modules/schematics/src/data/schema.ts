export interface Schema {
  /**
   * The name of the data entity.
   */
  name: string;

  /**
   * The path to create the entity model, service and spec.
   */
  path?: string;

  /**
   * The name of the project.
   */
  project?: string;

  /**
   * When true, does not create test files.
   */
  skipTests?: boolean;

  /**
   * When true (the default), creates the files in the path directly;
   * when false, creates them in a folder named after the entity.
   */
  flat?: boolean;

  /**
   * When true, creates the files within a 'data' folder.
   */
  group?: boolean;
}
