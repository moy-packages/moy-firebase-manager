import { concatMap, defer, expand, from, Observable, of, skipWhile, take, tap } from 'rxjs';
import { firestore, app } from 'firebase-admin';

function *obsIteratorFromDynamicArray({ dynamicArray }: { dynamicArray: Observable<any>[] }) {
  let index = 0;
  let dynamicArrayHasValues = true;
  let nextObs = dynamicArray[index++];

  while(dynamicArrayHasValues) {
    if (nextObs) yield nextObs;
    else dynamicArrayHasValues = false;
    nextObs = dynamicArray[index++];
  }
}

export class MoyFirestoreManager {
  private fs = this.admin.firestore();
  private batch = this.fs.batch();
  private commitQueue: Observable<any>[] = [];
  private readDocumentsMap: { [documentId: string]: any } = {};

  constructor(private admin: app.App, private collection: string) {}

  doc = (id: string) => {
    return this.readDocumentsMap[id];
  }

  commit = ({ dontCommitAndReturnExpression }: { dontCommitAndReturnExpression: boolean } = { dontCommitAndReturnExpression: false }) => {
    const obsIterator = obsIteratorFromDynamicArray({ dynamicArray: this.commitQueue });

    const committingObs = of(true).pipe(
      expand(() => obsIterator.next().value || of('__END__')),
      skipWhile(v => v !== '__END__'),
      take(1),
      concatMap(() => from(this.batch.commit())),
      tap(() => this.reset()),
    );

    if (dontCommitAndReturnExpression) {
      return committingObs;
    }

    committingObs.subscribe();
  }

  readToQueue = (prop: string, values: string[], sideEffect?: () => void): void => {
    const baseExpression = from(
      this.fs.collection(this.collection).where(prop, 'in', values).get()
    ).pipe(
      tap(query => query.docs.forEach(
        d => this.readDocumentsMap[d.id] = { ...d.data(), uid: d.id }
      ))
    );

    this.expressionToQueue(baseExpression, sideEffect);
  }
  
  expressionToQueue = (expression: Observable<any> | (() => any), sideEffect?: (any?: any) => void): void => {
    if (expression instanceof Observable) {
      this.commitQueue.push(sideEffect ? expression.pipe(tap({ next: () => sideEffect() })) : expression);
    } else {
      const exprToObs = defer(() => of(expression()));
      this.commitQueue.push(sideEffect ? exprToObs.pipe(tap({ next: () => sideEffect() })) : exprToObs);
    }
  }

  batchToQueue = (documentId: string, body: { [key: string]: any }, sideEffect?: () => void): void => {
    const ref = this.ref(documentId);
    const baseExpression = () => this.batch.set(ref, body, { merge: true });
    this.expressionToQueue(baseExpression, sideEffect);
  }

  private ref = (id: string): firestore.DocumentReference => {
    return this.fs.doc(`${this.collection}/${id}`);
  }

  private reset = (): void => {
    this.batch = this.fs.batch();
    this.commitQueue = [];
    this.readDocumentsMap = {};
  }
}
