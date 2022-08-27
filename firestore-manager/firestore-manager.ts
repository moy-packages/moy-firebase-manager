import { concatMap, expand, from, Observable, of, skipWhile, take, tap, map } from 'rxjs';
import * as fbApp from 'firebase-admin';
import { expressionToObservable, obsGeneratorFromDynamicArray } from './utils';
import { AfterCommitHistory } from './interfaces';
import { CRUD } from './constants';

export class MoyFirestoreManager {
  private fs = this.admin.firestore();
  private batch = this.fs.batch();
  private commitQueue: Observable<any>[] = [];
  private afterCommitCRUD: AfterCommitHistory = { [CRUD.Create]: {}, [CRUD.Read]: {}, [CRUD.Update]: {}, [CRUD.Delete]: {} };

  constructor(private admin: typeof fbApp, private collection: string) {}

  read = (id: string): any => {
    return this.afterCommitCRUD.read[id];
  }

  newDoc = (): string => {
    const newDocId = this.fs.collection(this.collection).doc().id;
    this.afterCommitCRUD.create[newDocId] = { uid: newDocId };
    return newDocId;
  }

  commit = (): Observable<AfterCommitHistory> => {
    const obsIterator = obsGeneratorFromDynamicArray({ dynamicArray: this.commitQueue });

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
        d => this.updateAfterCommitCRUD(d.id, CRUD.Read, { ...d.data(), uid: d.id })
      ))
    );

    this.expressionToQueue(baseExpression, sideEffect);
  }

  batchToQueue = (documentId: string, body: { [key: string]: any }, sideEffect?: () => void): void => {
    body.uid = documentId;
    const ref = this.ref(documentId);
    const isNewDoc = this.afterCommitCRUD.create[documentId] != null;

    this.updateAfterCommitCRUD(ref.id, isNewDoc ? CRUD.Create : CRUD.Update, body);
    const baseExpression = () => this.batch.set(ref, body, { merge: true });
    this.expressionToQueue(baseExpression, sideEffect);
  }

  deleteToQueue = (documentId: string, sideEffect?: () => void): void => {
    const ref = this.ref(documentId);

    this.updateAfterCommitCRUD(ref.id, CRUD.Delete, {});
    const baseExpression = () => this.batch.delete(ref);
    this.expressionToQueue(baseExpression, sideEffect);
  }
  
  expressionToQueue = (expression: Observable<any> | (() => any), sideEffect?: (any?: any) => void): void => {
    const observableExpression = expressionToObservable(expression);

    this.commitQueue.push(
      sideEffect
      ? observableExpression.pipe(tap({ next: () => sideEffect() }))
      : observableExpression
    );
  }

  private ref = (id: string): fbApp.firestore.DocumentReference => {
    return this.fs.collection(this.collection).doc(id);
  }

  private updateAfterCommitCRUD = (id: string, action: CRUD, body: any): void => {
    this.afterCommitCRUD[action][id] = {
      ...(this.afterCommitCRUD[action][id] || {}),
      ...body
    };
  }

  private reset = (): void => {
    this.batch = this.fs.batch();
    this.commitQueue = [];
  }
}
