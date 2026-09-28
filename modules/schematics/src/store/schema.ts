export interface Schema {
  /**
   * The name of the feature state. Not needed with `root`.
   */
  name?: string;

  /**
   * The path to create the state folder in.
   */
  path?: string;

  /**
   * The name of the project.
   */
  project?: string;

  /**
   * Has no effect: the state file is always created in the `statePath`
   * folder.
   */
  flat?: boolean;

  /**
   * Has no effect: this schematic creates no spec file.
   */
  skipTests?: boolean;

  /**
   * The NgModule (path) to register the state in. Without it, the nearest
   * NgModule is used, if the app has one.
   */
  module?: string;

  /**
   * The folder, relative to `path`, to create the state file (`index.ts`) in.
   */
  statePath?: string;

  /**
   * Specifies whether this is the root state or a feature state.
   */
  root?: boolean;

  /**
   * The name of the state interface.
   */
  stateInterface?: string;

  /**
   * With `root`, registers `StoreModule.forRoot({})` without creating the
   * state file.
   */
  minimal?: boolean;
}
