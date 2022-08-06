"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MoyFirestoreMock = void 0;
var firebase_admin_1 = require("firebase-admin");
var NEW_DOC_CODE = '__MOCK_NEW_DOC__';
// todo: separate this class with subclasses etc. Apply a little bit of SOLID here.
var MoyFirestoreMock = /** @class */ (function () {
    function MoyFirestoreMock(MOCK_DB_TO_USE) {
        var _this = this;
        this.MOCK_DB_TO_USE = MOCK_DB_TO_USE;
        this.fs = firebase_admin_1.firestore();
        this.spyOnDoc = function () {
            return jest.spyOn(_this.fs, 'doc').mockImplementation(function (wholePath) {
                return _this.getObjectRerferenceForPath(wholePath, _this.db);
            });
        };
        this.spyOnCollection = function () {
            return jest.spyOn(_this.fs, 'collection').mockImplementation(function (collection) {
                var dbCollection = _this.db[collection];
                return {
                    doc: function (id) { return _this.getObjectRerferenceForPath(collection + "/" + (id || NEW_DOC_CODE), _this.db); },
                    where: function (prop, operator, values) { return ({
                        get: function () {
                            return new Promise(function (resolves) { return resolves({
                                docs: Object.keys(dbCollection).reduce(function (results, uid) {
                                    if (values.includes(dbCollection[uid][prop])) {
                                        results.push({ id: uid, data: function () { return _this.deepCopy(dbCollection[uid]); } });
                                    }
                                    return results;
                                }, [])
                            }); });
                        }
                    }); },
                };
            });
        };
        this.spyOnBatch = function () {
            return jest.spyOn(_this.fs, 'batch').mockImplementation(function () {
                var batchInstance = {
                    __changes: _this.deepCopy(_this.db),
                    commit: function () {
                        return new Promise(function (resolves) {
                            _this.db = batchInstance.__changes;
                            resolves();
                        });
                    },
                    set: function (doc, value) {
                        var ref = _this.getObjectRerferenceForPath(doc.path, batchInstance.__changes).__result;
                        var _loop_1 = function (parentKey) {
                            var splittedKeys = parentKey.split('.');
                            splittedKeys.reduce(function (obj, _key, index) {
                                if ((splittedKeys.length - 1) <= index) {
                                    obj[_key] = value[parentKey];
                                    return;
                                }
                                if (!obj[_key])
                                    obj[_key] = {};
                                return obj[_key];
                            }, ref);
                        };
                        for (var parentKey in value) {
                            _loop_1(parentKey);
                        }
                    },
                };
                return batchInstance;
            });
        };
        // todo: separate this into its own class
        this.getObjectRerferenceForPath = function (path, from) {
            var id = '';
            var splitted = path.split('/');
            var resultingData = splitted.reduce(function (result, _path) {
                if (result[_path]) {
                    result[_path] = __assign({}, result[_path]);
                    id = _path;
                }
                else if (_path === NEW_DOC_CODE) {
                    id = "newId-" + (Math.random() * 100000).toFixed(0);
                    result[id] = {};
                }
                else {
                    throw new Error("Document " + _path + " does not exist");
                }
                return result[_path];
            }, from);
            return {
                id: id,
                path: path,
                get: function () {
                    return new Promise(function (resolves) {
                        resolves({ id: id, path: path, data: function () { return resultingData; } });
                    });
                },
                __result: resultingData,
            };
        };
        this.db = this.MOCK_DB_TO_USE;
        this.spyOnBatch();
        this.spyOnDoc();
        this.spyOnCollection();
    }
    MoyFirestoreMock.prototype.get = function (id) {
        return this.db.bags[id];
    };
    MoyFirestoreMock.prototype.reset = function () {
        this.db = this.deepCopy(this.MOCK_DB_TO_USE);
    };
    MoyFirestoreMock.prototype.deepCopy = function (db) {
        var _this = this;
        return Object.keys(db).reduce(function (built, key) {
            if (typeof built[key] === 'object') {
                built[key] = _this.deepCopy(built[key]);
            }
            return built;
        }, __assign({}, db));
    };
    return MoyFirestoreMock;
}());
exports.MoyFirestoreMock = MoyFirestoreMock;
