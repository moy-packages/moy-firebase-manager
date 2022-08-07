import { concatMap, defer, expand, from, Observable, of, skipWhile, take, tap, map } from 'rxjs';
import * as fbApp from 'firebase-admin';

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

interface DocumentDictionary { [id: string]: any };
export interface AfterCommitHistory {
  read: DocumentDictionary;
  create: DocumentDictionary;
  update: DocumentDictionary;
  delete: DocumentDictionary;
}

type CRUD = 'create' | 'read' | 'update' | 'delete';
export class MoyFirestoreManager {
  private fs = this.admin.firestore();
  private batch = this.fs.batch();
  private commitQueue: Observable<any>[] = [];
  private afterCommitCRUD: AfterCommitHistory = { create: {}, read: {}, update: {}, delete: {} };

  constructor(private admin: typeof fbApp, private collection: string) {}

  read = (id: string): any => {
    return this.afterCommitCRUD.read[id];
  }

  newDoc = (): string => {
    return this.fs.collection(this.collection).doc().id;
  }

  commit = (): Observable<AfterCommitHistory> => {
    const obsIterator = obsIteratorFromDynamicArray({ dynamicArray: this.commitQueue });

    return of(true).pipe(
      expand(() => obsIterator.next().value || of('__END__')),
      skipWhile(v => v !== '__END__'),
      take(1),
      concatMap(() => from(this.batch.commit())),
      map(() => this.afterCommitCRUD),
      tap(() => this.reset()),
    );
  }

  readToQueue = (prop: string, values: string[], sideEffect?: () => void): void => {
    const baseExpression = from(
      this.fs.collection(this.collection).where(prop, 'in', values).get()
    ).pipe(
      tap(query => query.docs.forEach(
        d => this.updateAfterCommitCRUD(d.id, 'read', { ...d.data(), uid: d.id })
      ))
    );

    this.expressionToQueue(baseExpression, sideEffect);
  }

  batchToQueue = (documentId: string | null, body: { [key: string]: any }, sideEffect?: () => void): void => {
    const ref = this.ref(documentId);

    this.updateAfterCommitCRUD(ref.id, documentId ? 'update' : 'create', body);
    const baseExpression = () => this.batch.set(ref, body, { merge: true });
    this.expressionToQueue(baseExpression, sideEffect);
  }

  deleteToQueue = (documentId: string, sideEffect?: () => void): void => {
    const ref = this.ref(documentId);

    this.updateAfterCommitCRUD(ref.id, 'delete', {});
    const baseExpression = () => this.batch.delete(ref);
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

  private ref = (id: string | null): fbApp.firestore.DocumentReference => {
    const collectionRef = this.fs.collection(this.collection);
    return id ? collectionRef.doc(id) : collectionRef.doc();
  }

  private updateAfterCommitCRUD = (id: string, action: CRUD, body: any): void => {
    this.afterCommitCRUD[action][id] = {
      ...(this.afterCommitCRUD[action][id]?.body || {}),
      ...body
    };
  }

  private reset = (): void => {
    this.batch = this.fs.batch();
    this.commitQueue = [];
    this.afterCommitCRUD = { create: {}, read: {}, update: {}, delete: {} };
  }
}
