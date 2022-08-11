import { defer, isObservable, Observable, of } from 'rxjs';

export function *obsGeneratorFromDynamicArray({ dynamicArray }: { dynamicArray: Observable<any>[] }) {
  let index = 0;
  let dynamicArrayHasValues = true;
  let nextObs = dynamicArray[index++];

  while(dynamicArrayHasValues) {
    if (nextObs) yield nextObs;
    else dynamicArrayHasValues = false;
    nextObs = dynamicArray[index++];
  }
}

export const expressionToObservable = (expression: Observable<any> | (() => any), sideEffect?: (any?: any) => void): Observable<any> => {
  if (isObservable(expression)) {
    return expression;
  }

  return defer(() => of(expression()));
}
