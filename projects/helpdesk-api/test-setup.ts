// Loaded before every spec (the shared vitest.config.mts). NestJS reads the
// constructor types that emitDecoratorMetadata records through
// reflect-metadata; loading it first means that metadata is recorded
// whichever order a spec happens to import its classes in.
import 'reflect-metadata';
