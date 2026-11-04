import { TestBed } from '@angular/core/testing';
import { MockReducerManager } from '../index';

describe('MockReducerManager', () => {
  it('exposes an observable reducer and accepts the no-op mutations', () => {
    const manager = TestBed.configureTestingModule({
      providers: [MockReducerManager],
    }).inject(MockReducerManager);

    expect(typeof manager.asObservable).toBe('function');
    expect(() => manager.addFeature({})).not.toThrow();
    expect(() => manager.addFeatures({})).not.toThrow();
    expect(() => manager.removeFeature({})).not.toThrow();
    expect(() => manager.removeFeatures({})).not.toThrow();
    expect(() => manager.addReducer('feature', () => undefined)).not.toThrow();
    expect(() => manager.addReducers({})).not.toThrow();
    expect(() => manager.removeReducer('feature')).not.toThrow();
    expect(() => manager.removeReducers(['feature'])).not.toThrow();
  });
});
