import { lastValueFrom } from 'rxjs';
import { MoyFirestoreMock } from '../testing/firestore.mock';
import { MoyFirestoreManager } from './firestore-manager';

const adminFirestoreMock = {
  firestore() {
    return this.firestoreObject;
  },
  firestoreObject: {
    doc() {},
    collection() {},
    batch() {},
  },
} as any;

const BAG_ID = 'test_uid';

const mockDb = {
  bags: {
    [BAG_ID]: {
      uid: BAG_ID,
      userUid: 'test_user',
      amount: 30,
    }
  },
}

describe('MoyFirestoreManager', () => {
  const firestoreMock = new MoyFirestoreMock(mockDb, adminFirestoreMock.firestore());
  const moyManager = new MoyFirestoreManager(adminFirestoreMock, 'bags');

  beforeEach(() => firestoreMock.reset());

  it('read & readToQueue: should properly add read to queue', async () => {
    expect(moyManager.read(BAG_ID)).toBeUndefined();

    moyManager.readToQueue('uid', [BAG_ID]);

    const { read } = await lastValueFrom(moyManager.commit());

    expect(read.test_uid).toStrictEqual(mockDb.bags.test_uid);
  });

  it('newDoc: should create a new Id and add it to the create returned object', async () => {
    const newDocId = moyManager.newDoc();

    const { create } = await lastValueFrom(moyManager.commit());

    expect(create[newDocId]).toBeTruthy();
  });

  describe('commit', () => {
    it('it should update the database only after commit is subscribed, not before', async () => {
      moyManager.batchToQueue(BAG_ID, { amount: 100 });
      const obs = moyManager.commit();
  
      expect(firestoreMock.get(BAG_ID).amount).toBe(30);
  
      await lastValueFrom(obs);
  
      expect(firestoreMock.get(BAG_ID).amount).toBe(100);
    });

    it('should still execute expressions added while commit subscribe is running', async () => {
      const mockFn = jest.fn();
      moyManager.expressionToQueue(() => {
        mockFn();
        moyManager.expressionToQueue(() => mockFn())
      });

      await lastValueFrom(moyManager.commit());

      expect(mockFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('batchToQueue', () => {
    it('should modify the properties passed and only those', async () => {
      moyManager.batchToQueue(BAG_ID, { amount: -20 });
      
      await lastValueFrom(moyManager.commit());

      expect(firestoreMock.get(BAG_ID)).toMatchObject({...mockDb.bags[BAG_ID], amount: -20 });
    });

    it('should return the modified values on commit', async () => {
      moyManager.batchToQueue(BAG_ID, { amount: -20 });
      
      const { update } = await lastValueFrom(moyManager.commit());

      expect(update).toMatchObject({ [BAG_ID]: { amount: -20 }});
    });
  })

  describe('deleteToQueue', () => {
    it('should delete the item after commit', async () => {
      moyManager.deleteToQueue(BAG_ID);
      
      await lastValueFrom(moyManager.commit());

      expect(firestoreMock.get(BAG_ID)).toBeUndefined();
    });

    it('should return the deleted values on commit', async () => {
      moyManager.deleteToQueue(BAG_ID);
      
      const { delete: deletedObject } = await lastValueFrom(moyManager.commit());

      expect(deletedObject).toMatchObject({ [BAG_ID]: {} });
    });
  });

  it('expressionToQueue: should execute anything that is passed as a callback', async () => {
    const mockFn = jest.fn();

    moyManager.expressionToQueue(mockFn);
    expect(mockFn).toHaveBeenCalledTimes(0);

    await lastValueFrom(moyManager.commit());

    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('sideEffect: should occur after execution of queue happens', async () => {
    const mockFn = jest.fn();
    expect(mockFn).toHaveBeenCalledTimes(0);

    moyManager.batchToQueue(BAG_ID, { amount: -20 }, mockFn);
      
    await lastValueFrom(moyManager.commit());

    expect(mockFn).toHaveBeenCalledTimes(1);
  });
});