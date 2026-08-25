import { Data, Params } from '@angular/router';
import { MemoizedSelector } from '@ngrx/store';

export type RouterStateSelectors<V> = {
  selectCurrentRoute: MemoizedSelector<V, any>;
  selectFragment: MemoizedSelector<V, string | null | undefined>;
  selectQueryParams: MemoizedSelector<V, Params | undefined>;
  selectQueryParam: (
    param: string
  ) => MemoizedSelector<V, string | string[] | undefined>;
  selectRouteParams: MemoizedSelector<V, Params | undefined>;
  selectRouteParam: (param: string) => MemoizedSelector<V, string | undefined>;
  selectRouteData: MemoizedSelector<V, Data | undefined>;
  selectRouteDataParam: (
    param: string
  ) => MemoizedSelector<V, string | undefined>;
  selectUrl: MemoizedSelector<V, string | undefined>;
  selectTitle: MemoizedSelector<V, string | undefined>;
};
