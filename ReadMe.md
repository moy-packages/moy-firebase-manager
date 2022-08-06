# Moy Firebase Manager
I created this package with the intension of having a way to communicate with firestore through a reactive way.

The basic idea is that actions get added to a queue. Then, they all are executed in order when `commit()` is called. This allows to keep adding and reading documents in an orderly fashion, but execute all read and writes in a single call.

It works by adding expressions, reads, or batch-writes to a Queue. And then, after committing it all, the call is executed. If any part of the batch fails, it all gets rolled back. I'll keep adding stuff to this manager when needed.

## Installation

Simply running
```bash
  npm install --save moy-firebase-manager
```
should be enough to add it to the project.

## How to use

### Getting Started
First, we have to have intialized the admin firestore package:

```typescript
import * as admin from 'firebase-admin';
import * as serviceAccount from './admin-config.json'; // this is a secret file that firebase provides to you

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  databaseURL: 'https://moyney-balancer.firebaseio.com',
});

export { admin };
```

Afterwards, simply initialize the FirestoreManager object:

```typescript
import { admin } from './my-firebase-app';

// 'employees' can be any collection name in your firestore root.
employeeestoreManager = new MoyFirestoreManager(admin, 'employees');
```

Then, you can start using it.

### READ: Reading any document
If on any part of your stream, there's a need to read another document, simply triggering:

```typescript
employeeManager.readToQueue('name', ['Fran']);
```

will read all documents in the `employees` collection where `name` equals `Fran`.

Do notice that this read has to be pushed to the queue before any other expression or action will attempt to read it. Otherwise it will fail with `document === undefined`.

all these reads can be accessed on any expression pushed to the queue by calling (inside the expression):

```typescript
employeeManager.doc('fran-id-123'); // to return the fran with id `fran-id-123`.
```

_Note: There's a known issue in which reading by property populates the docs to be read, but there's no way to access said objects without knowing the id beforehand. This is being solved for a future version_

### CREATE / UPDATE: Adding a batch-write to the queue

Firestore works better if all writes that are related occur in batches. Therefore, the writes are added to a batch. And it all happens at once when `commit()` is called. All related writes should then be commited independently.

To add a write:

```typescript
employeeManager.batchToQueue('fran-doc-123', { debt: 100, owes: ['juan-doc-3'] });
employeeManager.batchToQueue('juan-doc-3', { 'isOwed.fran-doc-123': 100 });
```

this is probably a horrible document structure. But for the sake of the example, it works: You would change both documents with related data, or fail in all of them at the same time. This will happen on calling `commit()`.

If you are creating an object, just passing `null` to the id will execute a write of a new object, with a new ObjectId. You can check these Ids on the return type of the `commit` function. (read more about it further).

```typescript
employeeManager.batchToQueue(null /* new Id will be created */, { debt: 100, owes: ['juan-doc-3'] });
```

### DELETE: Removing a document

For this we simply call `deleteToQueue` and when committing, the document will be removed unless errors happen.

```typescript
employeeManager.deleteToQueue('id-to-delete-123');
```

### Adding a custom expression to the Queue

Either an `Observable` or a `function` can be added to the queue. To execute custom logic on any step of the queue. For instance, after saving these debts (previous example), we call also make a call to another microservice:

```typescript
// add an observable directly, even from another collection through the same manager
const officeManager = new MoyFirestoreManager(admin, 'office');
const changeInOffice = officeManager.batchToQueue('office-123', { totalDebts: 100 }).commit({ dontCommitAndReturnExpression: true });
employeeManager.expressionToQueue(changeInOffice);

// add a custom expression to the queue
const calculateAverageDebtBeforePatching = () => {
  employeer1 = firestoreManager.doc('user-1');
  employeer2 = firestoreManager.doc('user-2');

  this.average = (user1.debt + user2.debt) / 2;
}
employeeManager.expressionToQueue(calculateAverageDebtBeforePatching);
```

Here there's more horrible examples that would probably not relate to real life structure, but still they work to prove as examples. You can add another observable to the queue, any function to the queue, or even an observable that comes from another `MoyFirestoreManager`. They will get added to the queue and calculated when their turn arrives in the commit order (so if you read a doc before, you can access it through the `doc` method).

### Side effects

Some changes could require a sideEffect on your part, for instance, updating a model's value that could be used later to do a calculation.

```typescript
const newTotalDebt = magicCalculation(anything);

const totalDebtModelUpdate = () => {
  this.totalDebt = newTotalDebt;
}

// this side effect can be added to any of the previous methods
// batch to queue
employeeManager.batchToQueue('user-1', { debt: 100 }, totalDebtModelUpdate);

// expression to queue
employeeManager.expressionToQueue(() => getConversionRateForDebt(100, 'eur/usd'), totalDebtModelUpdate);

// read to queue
employeeManager.readToQueue('id', ['user-1', 'user-2'], totalDebtModelUpdate);

// delete to queue
employeeManager.deleteToQueue('id', totalDebtModelUpdate);

```

## Comitting changes

Committing changes will trigger all actions in the queue, and either finish correctly or error out.
The `commit()` method always returns the committer function. But `.subscribe()` has to be called on it so the commit actually triggers.
This is useful when one manager will be part of the queue of another manager, and we want to commit at the given queue's turn, and not when adding the commit to the queue.

```typescript
const one = new MoyFirestoreManager(admin, 'collection-1');
const two = new MoyFirestoreManager(admin, 'collection-2');

// first some queues on two
two.expressionToQueue(() => console.log('TWO: first message'));
two.expressionToQueue(() => console.log('TWO: second message'));

// then one queue on one
one.expressionToQueue(() => console.log('ONE: first message'));

// then another one on two
two.expressionToQueue(() => console.log('TWO: third message'));

// we now commit all one's queue in this step of two's queue
two.expressionToQueue(one.commit());

// we add another some more on one. It will still trigger when two calls commit().
one.expressionToQueue(() => console.log('ONE: second message'));
one.expressionToQueue(() => console.log('ONE: final message'));

// another one on two, just to see the order in which things happen.
two.expressionToQueue(() => console.log('TWO: final message'));

two.commit().subscribe();

// 'TWO: first message'
// 'TWO: second message'
// 'ONE: first message'
// 'ONE: second message'
// 'ONE: final message'
// 'TWO: third message'
// 'TWO: final message'
```

Also, committing resets the batches and states inside the commit. It's similar to creating a new `MoyFirestoreManager` object, but without losing the reference.

Finally, you when committing you can capture the events with rxjs methods.

```typescript
onNext = (changes) => console.log('do something after commit', changes);
onError = (error) => console.error('do something to handle errors');
onComplete = (changes) => console.log('do something when this stream dies');

myManager.commit().subscribe({
  next: () => onNext(),
  error: () => onError(),
  complete: () => onComplete(),
})
```

Committing will pass an object to the subcribe of the type `{ [id: string]: any }` which includes all document's `id: body`, with the type of CRUD action done.
For example:

```typescript
{
  create: {
    'id-1-created': { foo: 'bar', amount: 10 },
  },
  read: {
    'id-3': { foo: 'bar', hey: 'whatddup' },
  },
  update: {},
  delete: { 'byebye-1': {} }
}
```

## Testing

This part basically exists because I use it. I created a Mock for this Manager to be used in Jest testing suites. It mocks calls to different firestore methods (from `firebase-admin`) and updates a passed MockDb that has been pre-created on init.
Problem is: I've only covered what I use. So hardly reusable by other projects.
