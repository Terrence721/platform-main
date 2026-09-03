import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as semver from 'semver';
import { platformVersion } from './libs-version';

function getAngularCoreVersion(): string {
  const pkgPath = join(import.meta.dirname, '../../../package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  return pkg.dependencies['@angular/core'];
}

describe('platformVersion', () => {
  it('is a valid semver range', () => {
    expect(semver.validRange(platformVersion)).not.toBeNull();
  });

  it('does not pin to a prerelease floor', () => {
    const minVersion = semver.minVersion(platformVersion);

    expect(minVersion?.prerelease).toEqual([]);
  });

  it('is satisfied by the @angular/core version this workspace pins', () => {
    const angularCoreVersion = getAngularCoreVersion();

    expect(semver.satisfies(angularCoreVersion, platformVersion)).toBe(true);
  });
});
