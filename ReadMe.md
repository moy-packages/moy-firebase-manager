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

### Reading any document
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

### Adding a batch-write to the queue

Firestore works better if all writes that are related occur in batches. Therefore, the writes are added to a batch. And it all happens at once when `commit()` is called. All related writes should then be commited independently.

To add a write:

```typescript
employeeManager.batchToQueue('fran-doc-123', { debt: 100, owes: ['juan-doc-3'] });
employeeManager.batchToQueue('juan-doc-3', { 'isOwed.fran-doc-123': 100 });
```

this is probably a horrible document structure. But for the sake of the example, it works: You would change both documents with related data, or fail in all of them at the same time. This will happen on calling `commit()`.

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
// Batch to queue
employeeManager.batchToQueue('user-1', { debt: 100 }, totalDebtModelUpdate);

// expression to queue
employeeManager.expressionToQueue(() => getConversionRateForDebt(100, 'eur/usd'), totalDebtModelUpdate);

// read to queue
employeeManager.readToQueue('id', ['user-1', 'user-2'], totalDebtModelUpdate);

```

## Comitting changes

Committing changes will trigger all actions in the queue, and either finish correctly or error out.
If committing while passing the option `{ dontCommitAndReturnExpression: true }`, it will return the committing expression, instead of actually executing the commit. This is useful when one manager will be part of the queue of another manager, and we want to commit at the given queue's turn, and not when calling the method.

```typescript
const one = new MoyFirestoreManager(admin, 'collection-1');
const two = new MoyFirestoreManager(admin, 'collection-2');

one.batchToQueue('prop', { yay: true });
// ...
// some other logic on two, and then we need to commit one here:

two.expressionToQueue(one.commit({ dontCommitAndReturnExpression: true }));

// two will wait for the turn of one in the queue before firing its commit
```

Also, committing resets the batches and states inside the commit. It's similar to creating a new `MoyFirestoreManager` object, but without losing the reference.

Finally, you can commit manually with rxjs methods.

```typescript
// trigger automatic commit
myManager.commit();

// trigger commit manually
myManager.commit({ dontCommitAndReturnExpression: true }).subscribe({
  next: () => console.log('do something after commit'),
  error: () => console.error('do something to handle errors'),
  complete: () => console.log('do something when this stream dies'),
})
```

## Testing

This part basically exists because I use it. I created a Mock for this Manager to be used in Jest testing suites. It mocks calls to different firestore methods (from `firebase-admin`) and updates a passed MockDb that has been pre-created on init.
Problem is: I've only covered what I use. So hardly reusable by other projects.
