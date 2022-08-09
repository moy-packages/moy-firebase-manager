import { firestore } from 'firebase-admin';

const NEW_DOC_CODE = '__MOCK_NEW_DOC__';
// todo: separate this class with subclasses etc. Apply a little bit of SOLID here.
export class MoyFirestoreMock {
  private db: { [db: string]: any };
  private batchDb: { [db: string]: any };

  constructor(private readonly MOCK_DB_TO_USE: { [db: string]: any }, private fs: firestore.Firestore) {
    this.db = this.deepCopy(this.MOCK_DB_TO_USE);
    this.batchDb = this.deepCopy(this.MOCK_DB_TO_USE);
    this.spyOnBatch();
    this.spyOnDoc();
    this.spyOnCollection();
  }

  get(id: string): any {
    return this.db.bags[id];
  }

  reset(): void {
    this.db = this.deepCopy(this.MOCK_DB_TO_USE);
    this.batchDb = this.deepCopy(this.MOCK_DB_TO_USE);
  }

  private spyOnDoc = (): jest.SpyInstance => {
    return jest.spyOn(this.fs, 'doc').mockImplementation((wholePath: string) => {
      return this.getObjectRerferenceForPath(wholePath, this.batchDb);
    });
  }

  private spyOnCollection = (): jest.SpyInstance => {
    return jest.spyOn(this.fs, 'collection').mockImplementation((collection: string): any => {
      const dbCollection = (<any>this.batchDb)[collection];
      return {
        doc: (id: string | null) => this.getObjectRerferenceForPath(`${collection}/${id || NEW_DOC_CODE}`, this.batchDb),
        where: (prop: string, operator: 'in', values: string[]) => ({
          get: (): any => {
            return new Promise(
              (resolves) => resolves({
                docs: Object.keys(dbCollection).reduce((results, uid: string) => {
                  if (values.includes(dbCollection[uid][prop])) {
                    results.push({ id: uid, data: () => this.deepCopy(dbCollection[uid]) });
                  }
                  return results;
                }, [] as any[])
              })
            );
          }
        }),
      }
    });
  }

  private spyOnBatch = (): jest.SpyInstance => {
    return jest.spyOn(this.fs, 'batch').mockImplementation(() => {
      const batchInstance: any = {
        __changes: () => { return this.batchDb },
        commit: () => {
          return new Promise<void>((resolves) => {
            this.db = batchInstance.__changes();
            resolves();
          });
        },
        set: (doc: { id: string; path: string; data: () => any }, value: any) => {
          const ref = this.getObjectRerferenceForPath(doc.path, batchInstance.__changes()).__result;

          for (let parentKey in value) {
            const splittedKeys = parentKey.split('.');
            splittedKeys.reduce((obj, _key, index) => {
              if ((splittedKeys.length - 1) <= index) {
                obj[_key] = value[parentKey];
                return;
              }

              if (!obj[_key]) obj[_key] = {};
              return obj[_key];
            }, ref);
          }
        },
        delete: (doc: { id: string; path: string; data: () => any }) => {
          const pathWithoutId = doc.path.replace(`/${doc.id}`, '');
          const objToDeleteDoc = this.getObjectRerferenceForPath(pathWithoutId, batchInstance.__changes()).__result;
          delete objToDeleteDoc[doc.id];
        }
      };

      return batchInstance;
    });
  }

  // todo: separate this into its own class
  private getObjectRerferenceForPath = (path: string, from: { [property: string]: any }): any => {
    let id = '';
    const newId = `new-${(Math.random()* 100000).toFixed(0)}`;
    const splitted = path.replace(NEW_DOC_CODE, newId).split('/');

    if (splitted.includes(newId)) {
      splitted.reduce((bodyRef, path) => {
        if (path === newId) {
          bodyRef[path] = { uid: newId };
        }
        return bodyRef[path];
      }, this.batchDb);
    }

    const resultingData = splitted.reduce((result, _path) => {
      if (result[_path]) {
        result[_path] = { ...result[_path] };
        id = _path;
      } else {
        throw new Error(`Document ${_path} does not exist`);
      }
      return result[_path];
    }, from);

    return {
      id,
      path,
      get() {
        return new Promise((resolves) => {
          resolves({ id, path, data: () => resultingData });
        });
      },
      __result: resultingData,
    }
  }

  private deepCopy<T>(db: T): T {
    return Object.keys(db).reduce((built, key) => {
      if (typeof built[key] === 'object') {
        built[key] = this.deepCopy(built[key]);
      }
      return built;
    }, { ...db } as any);
  }
}
