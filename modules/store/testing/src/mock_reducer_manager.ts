import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ActionReducer } from '@ngrx/store';

@Injectable()
export class MockReducerManager {
  private readonly reducer$ = new BehaviorSubject<ActionReducer<any, any>>(
    () => undefined
  );

  asObservable(): Observable<ActionReducer<any, any>> {
    return this.reducer$.asObservable();
  }

  addFeature(feature: any) {
    /* noop */
  }

  addFeatures(feature: any) {
    /* noop */
  }

  removeFeature(feature: any) {
    /* noop */
  }

  removeFeatures(features: any) {
    /* noop */
  }

  addReducer(key: any, reducer: any) {
    /* noop */
  }

  addReducers(reducers: any) {
    /* noop */
  }

  removeReducer(featureKey: any) {
    /* noop */
  }

  removeReducers(featureKeys: any) {
    /* noop */
  }
}
